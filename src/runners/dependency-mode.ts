import { analyzeDependencies } from '../analyzers/import/index.js'
import { printDependencyTree } from '../renderers/dependency-tree.js'
import { graphToSerializableTree } from '../serializers/dependency-tree.js'
import type { DependencyGraph } from '../types.js'
import { BaseModeRunner } from './base.js'

export class DependencyModeRunner extends BaseModeRunner<DependencyGraph> {
  protected analyze(): DependencyGraph {
    return analyzeDependencies(this.options.entryFile, this.getAnalyzeOptions())
  }

  protected serialize(graph: DependencyGraph): object {
    return graphToSerializableTree(graph, {
      omitUnused: this.options.omitUnused,
    })
  }

  protected render(graph: DependencyGraph): string {
    return printDependencyTree(graph, {
      cwd: this.options.cwd ?? graph.cwd,
      includeExternals: this.options.includeExternals,
      omitUnused: this.options.omitUnused,
    })
  }
}
