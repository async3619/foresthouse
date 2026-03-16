import type ts from 'typescript'

import type { SourceModuleNode } from '../../types/source-module-node.js'
import {
  createModuleResolutionHost,
  createProgram,
  createSourceFile,
} from '../../typescript/program.js'
import { normalizeFilePath } from '../../utils/normalize-file-path.js'
import { collectModuleReferences } from './references.js'
import { resolveDependency } from './resolver.js'

export function buildDependencyGraph(
  entryPath: string,
  compilerOptions: ts.CompilerOptions,
  cwd: string,
): Map<string, SourceModuleNode> {
  return new DependencyGraphBuilder(entryPath, compilerOptions, cwd).build()
}

class DependencyGraphBuilder {
  private readonly host: ts.ModuleResolutionHost
  private readonly nodes = new Map<string, SourceModuleNode>()
  private readonly program: ts.Program
  private readonly checker: ts.TypeChecker

  constructor(
    private readonly entryPath: string,
    private readonly compilerOptions: ts.CompilerOptions,
    cwd: string,
  ) {
    this.host = createModuleResolutionHost(cwd)
    this.program = createProgram(entryPath, compilerOptions, cwd)
    this.checker = this.program.getTypeChecker()
  }

  build(): Map<string, SourceModuleNode> {
    this.visitFile(this.entryPath)
    return this.nodes
  }

  private visitFile(filePath: string): void {
    const normalizedPath = normalizeFilePath(filePath)
    if (this.nodes.has(normalizedPath)) {
      return
    }

    const sourceFile =
      this.program.getSourceFile(normalizedPath) ??
      createSourceFile(normalizedPath)

    const references = collectModuleReferences(sourceFile, this.checker)
    const dependencies = references.map((reference) =>
      resolveDependency(
        reference,
        normalizedPath,
        this.compilerOptions,
        this.host,
      ),
    )

    this.nodes.set(normalizedPath, {
      id: normalizedPath,
      dependencies,
    })

    for (const dependency of dependencies) {
      if (dependency.kind === 'source') {
        this.visitFile(dependency.target)
      }
    }
  }
}
