import path from 'node:path'

import type { AnalyzeOptions, DependencyGraph } from '../../types.js'
import { loadCompilerOptions } from '../../typescript/config.js'
import { resolveExistingPath } from './entry.js'
import { buildDependencyGraph } from './graph.js'

export function analyzeDependencies(
  entryFile: string,
  options: AnalyzeOptions = {},
): DependencyGraph {
  return new ImportAnalyzer(entryFile, options).analyze()
}

class ImportAnalyzer {
  private readonly cwd: string
  private readonly entryPath: string

  constructor(
    entryFile: string,
    private readonly options: AnalyzeOptions,
  ) {
    this.cwd = path.resolve(options.cwd ?? process.cwd())
    this.entryPath = resolveExistingPath(this.cwd, entryFile)
  }

  analyze(): DependencyGraph {
    const { compilerOptions, path: configPath } = loadCompilerOptions(
      path.dirname(this.entryPath),
      this.options.configPath,
    )
    const nodes = buildDependencyGraph(
      this.entryPath,
      compilerOptions,
      this.cwd,
    )

    return {
      cwd: this.cwd,
      entryId: this.entryPath,
      nodes,
      ...(configPath === undefined ? {} : { configPath }),
    }
  }
}
