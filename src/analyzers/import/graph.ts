import path from 'node:path'
import { ResolverFactory } from 'oxc-resolver'
import type ts from 'typescript'

import type { SourceModuleNode } from '../../types/source-module-node.js'
import { loadCompilerOptions } from '../../typescript/config.js'
import { createProgram, createSourceFile } from '../../typescript/program.js'
import { normalizeFilePath } from '../../utils/normalize-file-path.js'
import { collectModuleReferences } from './references.js'
import { resolveDependency } from './resolver.js'

export function buildDependencyGraph(
  entryPath: string,
  options: BuildDependencyGraphOptions,
): Map<string, SourceModuleNode> {
  return new DependencyGraphBuilder(entryPath, options).build()
}

export interface BuildDependencyGraphOptions {
  readonly cwd: string
  readonly entryConfigPath?: string
  readonly entryCompilerOptions: ts.CompilerOptions
  readonly expandWorkspaces: boolean
  readonly projectOnly: boolean
}

class DependencyGraphBuilder {
  private readonly nodes = new Map<string, SourceModuleNode>()
  private readonly configCache = new Map<
    string,
    import('./resolver.js').ResolverConfigContext
  >()
  private readonly programCache = new Map<string, ts.Program>()
  private readonly checkerCache = new Map<string, ts.TypeChecker>()
  private readonly resolverCache = new Map<string, ResolverFactory>()

  constructor(
    private readonly entryPath: string,
    private readonly options: BuildDependencyGraphOptions,
  ) {
    const entryConfig: import('./resolver.js').ResolverConfigContext = {
      compilerOptions: options.entryCompilerOptions,
      ...(options.entryConfigPath === undefined
        ? {}
        : { path: options.entryConfigPath }),
    }

    this.configCache.set(path.dirname(this.entryPath), entryConfig)
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

    const config = this.getConfigForFile(normalizedPath)
    const program = this.getProgramForFile(normalizedPath, config)
    const checker = this.getCheckerForFile(normalizedPath, config)
    const sourceFile =
      program.getSourceFile(normalizedPath) ?? createSourceFile(normalizedPath)

    const references = collectModuleReferences(sourceFile, checker)
    const dependencies = references.map((reference) =>
      resolveDependency(reference, normalizedPath, {
        cwd: this.options.cwd,
        expandWorkspaces: this.options.expandWorkspaces,
        projectOnly: this.options.projectOnly,
        getConfigForFile: (targetPath) => this.getConfigForFile(targetPath),
        getResolverForFile: (targetPath) => this.getResolverForFile(targetPath),
        ...(this.options.entryConfigPath === undefined
          ? {}
          : { entryConfigPath: this.options.entryConfigPath }),
      }),
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

  private getConfigForFile(
    filePath: string,
  ): import('./resolver.js').ResolverConfigContext {
    const directory = path.dirname(filePath)
    const cached = this.configCache.get(directory)
    if (cached !== undefined) {
      return cached
    }

    const loaded = loadCompilerOptions(directory)
    this.configCache.set(directory, loaded)
    return loaded
  }

  private getProgramForFile(
    filePath: string,
    config: import('./resolver.js').ResolverConfigContext,
  ): ts.Program {
    const cacheKey = this.getProgramCacheKey(filePath, config)
    const cached = this.programCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const currentDirectory =
      config.path === undefined
        ? path.dirname(filePath)
        : path.dirname(config.path)
    const program = createProgram(
      filePath,
      config.compilerOptions,
      currentDirectory,
    )
    this.programCache.set(cacheKey, program)
    return program
  }

  private getCheckerForFile(
    filePath: string,
    config: import('./resolver.js').ResolverConfigContext,
  ): ts.TypeChecker {
    const cacheKey = this.getProgramCacheKey(filePath, config)
    const cached = this.checkerCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const checker = this.getProgramForFile(filePath, config).getTypeChecker()
    this.checkerCache.set(cacheKey, checker)
    return checker
  }

  private getProgramCacheKey(
    filePath: string,
    config: import('./resolver.js').ResolverConfigContext,
  ): string {
    return config.path ?? `default:${path.dirname(filePath)}`
  }

  private getResolverForFile(filePath: string): ResolverFactory {
    const config = this.getConfigForFile(filePath)
    const cacheKey = this.getProgramCacheKey(filePath, config)
    const cached = this.resolverCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    const resolver = new ResolverFactory({
      builtinModules: true,
      conditionNames: ['import', 'require', 'default'],
      extensions: [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.mts',
        '.cts',
        '.mjs',
        '.cjs',
        '.json',
      ],
      mainFields: ['types', 'module', 'main'],
      tsconfig:
        config.path === undefined ? 'auto' : { configFile: config.path },
    })
    this.resolverCache.set(cacheKey, resolver)
    return resolver
  }
}
