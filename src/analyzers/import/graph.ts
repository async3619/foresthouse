import type ts from 'typescript'

import type { SourceModuleNode } from '../../types.js'
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
  const host = createModuleResolutionHost(cwd)
  const nodes = new Map<string, SourceModuleNode>()
  const program = createProgram(entryPath, compilerOptions, cwd)
  const checker = program.getTypeChecker()

  visitFile(entryPath, compilerOptions, host, checker, program, nodes)
  return nodes
}

function visitFile(
  filePath: string,
  compilerOptions: ts.CompilerOptions,
  host: ts.ModuleResolutionHost,
  checker: ts.TypeChecker,
  program: ts.Program,
  nodes: Map<string, SourceModuleNode>,
): void {
  const normalizedPath = normalizeFilePath(filePath)
  if (nodes.has(normalizedPath)) {
    return
  }

  const sourceFile =
    program.getSourceFile(normalizedPath) ?? createSourceFile(normalizedPath)

  const references = collectModuleReferences(sourceFile, checker)
  const dependencies = references.map((reference) =>
    resolveDependency(reference, normalizedPath, compilerOptions, host),
  )

  nodes.set(normalizedPath, {
    id: normalizedPath,
    dependencies,
  })

  for (const dependency of dependencies) {
    if (dependency.kind === 'source') {
      visitFile(
        dependency.target,
        compilerOptions,
        host,
        checker,
        program,
        nodes,
      )
    }
  }
}
