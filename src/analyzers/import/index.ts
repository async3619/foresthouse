import path from 'node:path'

import type ts from 'typescript'
import type { AnalyzeOptions } from '../../types/analyze-options.js'
import type { DependencyGraph } from '../../types/dependency-graph.js'

import { loadCompilerOptions } from '../../typescript/config.js'
import { BaseAnalyzer } from '../base.js'
import { resolveExistingPath } from './entry.js'
import { buildDependencyGraph } from './graph.js'

export function analyzeDependencies(
  entryFile: string,
  options: AnalyzeOptions = {},
): DependencyGraph {
  const graph = analyzeDependenciesForEntries([entryFile], options)

  return {
    cwd: graph.cwd,
    entryId: graph.entryId,
    nodes: graph.nodes,
    ...(graph.configPath === undefined ? {} : { configPath: graph.configPath }),
  }
}

export interface MultiEntryDependencyGraph extends DependencyGraph {
  readonly entryIds: readonly string[]
}

export function analyzeDependenciesForEntries(
  entryFiles: readonly string[],
  options: AnalyzeOptions = {},
): MultiEntryDependencyGraph {
  return new MultiEntryImportAnalyzer(entryFiles, options).analyze()
}

class MultiEntryImportAnalyzer extends BaseAnalyzer<MultiEntryDependencyGraph> {
  private readonly cwd: string
  private readonly entryPaths: readonly string[]

  constructor(entryFiles: readonly string[], options: AnalyzeOptions) {
    const [firstEntryFile] = entryFiles
    if (firstEntryFile === undefined) {
      throw new Error('At least one entry file is required.')
    }

    super(firstEntryFile, options)
    this.cwd = path.resolve(options.cwd ?? process.cwd())
    this.entryPaths = [...new Set(entryFiles)].map((entryFile) =>
      resolveExistingPath(this.cwd, entryFile),
    )
  }

  protected doAnalyze(): MultiEntryDependencyGraph {
    const entryConfigs = this.resolveEntryConfigs()
    const nodes = buildDependencyGraph(entryConfigs, {
      cwd: this.cwd,
      expandWorkspaces: this.options.expandWorkspaces ?? true,
      projectOnly: this.options.projectOnly ?? false,
      trackUnusedImports: this.options.trackUnusedImports ?? true,
    })
    const uniqueConfigPaths = [
      ...new Set(entryConfigs.map((entry) => entry.configPath)),
    ]
    const configPath =
      uniqueConfigPaths.length === 1 ? uniqueConfigPaths[0] : undefined
    const [firstEntryPath] = this.entryPaths

    if (firstEntryPath === undefined) {
      throw new Error('At least one entry file is required.')
    }

    return {
      cwd: this.cwd,
      entryId: firstEntryPath,
      entryIds: this.entryPaths,
      nodes,
      ...(configPath === undefined ? {} : { configPath }),
    }
  }

  private resolveEntryConfigs(): EntryConfig[] {
    const configCache = new Map<string, LoadedEntryConfig>()

    return this.entryPaths.map((entryPath) => {
      const directory = path.dirname(entryPath)
      const cached = configCache.get(directory)
      if (cached !== undefined) {
        return {
          entryPath,
          compilerOptions: cached.compilerOptions,
          ...(cached.configPath === undefined
            ? {}
            : { configPath: cached.configPath }),
        }
      }

      const loaded = loadCompilerOptions(directory, this.options.configPath)
      const resolved: LoadedEntryConfig = {
        compilerOptions: loaded.compilerOptions,
        ...(loaded.path === undefined ? {} : { configPath: loaded.path }),
      }
      configCache.set(directory, resolved)

      return {
        entryPath,
        compilerOptions: resolved.compilerOptions,
        ...(resolved.configPath === undefined
          ? {}
          : { configPath: resolved.configPath }),
      }
    })
  }
}

interface EntryConfig {
  readonly entryPath: string
  readonly compilerOptions: ts.CompilerOptions
  readonly configPath?: string
}

interface LoadedEntryConfig {
  readonly compilerOptions: ts.CompilerOptions
  readonly configPath?: string
}
