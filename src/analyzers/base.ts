import type { AnalyzeOptions } from '../types/analyze-options.js'

export abstract class BaseAnalyzer<TGraph> {
  constructor(
    protected readonly entryFile: string,
    protected readonly options: AnalyzeOptions,
  ) {}

  analyze(): TGraph {
    return this.doAnalyze()
  }

  protected abstract doAnalyze(): TGraph
}
