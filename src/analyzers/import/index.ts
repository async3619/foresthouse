import path from 'node:path'

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
  return new ImportAnalyzer(entryFile, options).analyze()
}

class ImportAnalyzer extends BaseAnalyzer<DependencyGraph> {
  private readonly cwd: string
  private readonly entryPath: string

  constructor(entryFile: string, options: AnalyzeOptions) {
    super(entryFile, options)
    this.cwd = path.resolve(options.cwd ?? process.cwd())
    this.entryPath = resolveExistingPath(this.cwd, entryFile)
  }

  protected doAnalyze(): DependencyGraph {
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
