import { analyzeReactUsage } from '../analyzers/react/index.js'
import { printReactUsageTree } from '../renderers/react-usage-tree.js'
import { graphToSerializableReactTree } from '../serializers/react-usage-tree.js'
import type { ReactUsageFilter, ReactUsageGraph } from '../types.js'
import { BaseModeRunner } from './base.js'

export class ReactModeRunner extends BaseModeRunner<ReactUsageGraph> {
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

  private getFilter(): ReactUsageFilter {
    return this.options.react ?? 'all'
  }
}
