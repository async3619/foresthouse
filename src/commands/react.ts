import { analyzeReactUsage } from '../analyzers/react/index.js'
import type { ReactCliOptions } from '../app/args.js'
import { printReactUsageTree } from '../output/ascii/react.js'
import { graphToSerializableReactTree } from '../output/json/react.js'
import type { AnalyzeOptions } from '../types/analyze-options.js'
import type { ReactUsageFilter } from '../types/react-usage-filter.js'
import type { ReactUsageGraph } from '../types/react-usage-graph.js'
import { BaseCommand } from './base.js'

export class ReactCommand extends BaseCommand<
  ReactUsageGraph,
  ReactCliOptions
> {
  protected analyze(): ReactUsageGraph {
    return analyzeReactUsage(this.options.entryFile, this.getAnalyzeOptions())
  }

  protected serialize(graph: ReactUsageGraph): object {
    return graphToSerializableReactTree(graph, {
      filter: this.getFilter(),
    })
  }

  protected render(graph: ReactUsageGraph): string {
    return printReactUsageTree(graph, {
      cwd: this.options.cwd ?? graph.cwd,
      filter: this.getFilter(),
    })
  }

  protected getAnalyzeOptions(): AnalyzeOptions {
    return {
      ...super.getAnalyzeOptions(),
      includeBuiltins: this.options.includeBuiltins,
    }
  }

  private getFilter(): ReactUsageFilter {
    return this.options.filter
  }
}
