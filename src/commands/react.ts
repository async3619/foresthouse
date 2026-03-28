import { analyzeReactUsageDiff } from '../analyzers/react/diff.js'
import { analyzeReactUsage } from '../analyzers/react/index.js'
import type { ReactCliOptions } from '../app/args.js'
import { resolveReactEntryFiles } from '../app/react-entry-files.js'
import {
  printReactUsageDiffTree,
  printReactUsageTree,
} from '../output/ascii/react.js'
import {
  diffGraphToSerializableReactTree,
  graphToSerializableReactTree,
} from '../output/json/react.js'
import type { AnalyzeOptions } from '../types/analyze-options.js'
import type { ReactUsageDiffGraph } from '../types/react-usage-diff-graph.js'
import type { ReactUsageFilter } from '../types/react-usage-filter.js'
import type { ReactUsageGraph } from '../types/react-usage-graph.js'
import { BaseCommand } from './base.js'

export class ReactCommand extends BaseCommand<
  ReactUsageGraph | ReactUsageDiffGraph,
  ReactCliOptions
> {
  protected analyze(): ReactUsageGraph | ReactUsageDiffGraph {
    if (this.options.diff !== undefined) {
      return analyzeReactUsageDiff(this.options)
    }

    return analyzeReactUsage(
      resolveReactEntryFiles(this.options),
      this.getAnalyzeOptions(),
    )
  }

  protected serialize(graph: ReactUsageGraph | ReactUsageDiffGraph): object {
    if (isReactUsageDiffGraph(graph)) {
      return diffGraphToSerializableReactTree(graph)
    }

    return graphToSerializableReactTree(graph, {
      filter: this.getFilter(),
    })
  }

  protected render(graph: ReactUsageGraph | ReactUsageDiffGraph): string {
    if (isReactUsageDiffGraph(graph)) {
      return printReactUsageDiffTree(graph)
    }

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

function isReactUsageDiffGraph(
  graph: ReactUsageGraph | ReactUsageDiffGraph,
): graph is ReactUsageDiffGraph {
  return 'kind' in graph && graph.kind === 'react-usage-diff'
}
