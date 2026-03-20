import fs from 'node:fs'
import path from 'node:path'
import { ResolverFactory } from 'oxc-resolver'
import type ts from 'typescript'

import type { DependencyEdge } from '../../types/dependency-edge.js'
import type { DependencyKind } from '../../types/dependency-kind.js'
import type { SourceModuleNode } from '../../types/source-module-node.js'
import { loadCompilerOptions } from '../../typescript/config.js'
import { createProgram, createSourceFile } from '../../typescript/program.js'
import { normalizeFilePath } from '../../utils/normalize-file-path.js'
import { collectModuleReferences } from './references.js'
import { resolveDependency } from './resolver.js'

export function buildDependencyGraph(
  entryConfigs: readonly EntryConfig[],
  options: BuildDependencyGraphOptions,
): Map<string, SourceModuleNode> {
  return new DependencyGraphBuilder(entryConfigs, options).build()
}

export interface EntryConfig {
  readonly entryPath: string
  readonly compilerOptions: ts.CompilerOptions
  readonly configPath?: string
}

export interface BuildDependencyGraphOptions {
  readonly cwd: string
  readonly expandWorkspaces: boolean
  readonly projectOnly: boolean
  readonly trackUnusedImports: boolean
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
  private readonly resolutionCache = new Map<
    string,
    CachedDependencyResolution
  >()
  private readonly packageRootCache = new Map<string, string | undefined>()

  constructor(
    private readonly entryConfigs: readonly EntryConfig[],
    private readonly options: BuildDependencyGraphOptions,
  ) {
    entryConfigs.forEach((entryConfig) => {
      this.configCache.set(path.dirname(entryConfig.entryPath), {
        compilerOptions: entryConfig.compilerOptions,
        ...(entryConfig.configPath === undefined
          ? {}
          : { path: entryConfig.configPath }),
      })
    })
  }

  build(): Map<string, SourceModuleNode> {
    this.entryConfigs.forEach((entryConfig) => {
      this.visitFile(entryConfig.entryPath, entryConfig.configPath)
    })
    return this.nodes
  }

  private visitFile(filePath: string, entryConfigPath?: string): void {
    const normalizedPath = normalizeFilePath(filePath)
    if (this.nodes.has(normalizedPath)) {
      return
    }

    const config = this.getConfigForFile(normalizedPath)
    const checker = this.options.trackUnusedImports
      ? this.getCheckerForFile(normalizedPath, config)
      : undefined
    const sourceFile = this.getSourceFileForFile(normalizedPath, config)

    const references = collectModuleReferences(sourceFile, checker)
    const dependencies = references.map((reference) =>
      this.resolveDependencyWithCache(
        reference,
        normalizedPath,
        config,
        entryConfigPath,
      ),
    )

    this.nodes.set(normalizedPath, {
      id: normalizedPath,
      dependencies,
    })

    for (const dependency of dependencies) {
      if (dependency.kind === 'source') {
        this.visitFile(dependency.target, entryConfigPath)
      }
    }
  }

  private getSourceFileForFile(
    filePath: string,
    config: import('./resolver.js').ResolverConfigContext,
  ): ts.SourceFile {
    if (!this.options.trackUnusedImports) {
      return createSourceFile(filePath)
    }

    return (
      this.getProgramForFile(filePath, config).getSourceFile(filePath) ??
      createSourceFile(filePath)
    )
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

  private resolveDependencyWithCache(
    reference: Parameters<typeof resolveDependency>[0],
    containingFile: string,
    config: import('./resolver.js').ResolverConfigContext,
    entryConfigPath?: string,
  ): DependencyEdge {
    const cacheKey = this.getResolutionCacheKey(
      reference.specifier,
      containingFile,
      config,
      entryConfigPath,
    )
    const cachedResolution = this.resolutionCache.get(cacheKey)

    if (cachedResolution !== undefined) {
      return toDependencyEdge(reference, cachedResolution)
    }

    const resolved = resolveDependency(reference, containingFile, {
      cwd: this.options.cwd,
      expandWorkspaces: this.options.expandWorkspaces,
      projectOnly: this.options.projectOnly,
      getConfigForFile: (targetPath) => this.getConfigForFile(targetPath),
      getResolverForFile: (targetPath) => this.getResolverForFile(targetPath),
      ...(entryConfigPath === undefined ? {} : { entryConfigPath }),
    })

    this.resolutionCache.set(cacheKey, {
      kind: resolved.kind,
      target: resolved.target,
      ...(resolved.boundary === undefined
        ? {}
        : { boundary: resolved.boundary }),
    })

    return resolved
  }

  private getResolutionCacheKey(
    specifier: string,
    containingFile: string,
    config: import('./resolver.js').ResolverConfigContext,
    entryConfigPath?: string,
  ): string {
    const scopeKey = entryConfigPath ?? ''

    if (isPackageLikeImport(specifier)) {
      const packageRoot =
        this.getPackageRoot(containingFile) ?? path.dirname(containingFile)
      return `package:${this.getProgramCacheKey(containingFile, config)}:${packageRoot}:${specifier}:${scopeKey}`
    }

    return `path:${path.dirname(containingFile)}:${specifier}:${scopeKey}`
  }

  private getPackageRoot(filePath: string): string | undefined {
    const startDirectory = path.dirname(filePath)
    if (this.packageRootCache.has(startDirectory)) {
      return this.packageRootCache.get(startDirectory)
    }

    const traversedDirectories: string[] = []
    let currentDirectory = startDirectory

    while (true) {
      if (this.packageRootCache.has(currentDirectory)) {
        const cached = this.packageRootCache.get(currentDirectory)
        traversedDirectories.forEach((directory) => {
          this.packageRootCache.set(directory, cached)
        })
        return cached
      }

      traversedDirectories.push(currentDirectory)

      if (fs.existsSync(path.join(currentDirectory, 'package.json'))) {
        traversedDirectories.forEach((directory) => {
          this.packageRootCache.set(directory, currentDirectory)
        })
        return currentDirectory
      }

      const parentDirectory = path.dirname(currentDirectory)
      if (parentDirectory === currentDirectory) {
        traversedDirectories.forEach((directory) => {
          this.packageRootCache.set(directory, undefined)
        })
        return undefined
      }

      currentDirectory = parentDirectory
    }
  }
}

interface CachedDependencyResolution {
  readonly kind: DependencyKind
  readonly target: string
  readonly boundary?: 'workspace' | 'project'
}

function isPackageLikeImport(specifier: string): boolean {
  return !specifier.startsWith('.') && !path.isAbsolute(specifier)
}

function toDependencyEdge(
  reference: Parameters<typeof resolveDependency>[0],
  resolution: CachedDependencyResolution,
): DependencyEdge {
  return {
    specifier: reference.specifier,
    referenceKind: reference.referenceKind,
    isTypeOnly: reference.isTypeOnly,
    unused: reference.unused,
    kind: resolution.kind,
    target: resolution.target,
    ...(resolution.boundary === undefined
      ? {}
      : { boundary: resolution.boundary }),
  }
}
