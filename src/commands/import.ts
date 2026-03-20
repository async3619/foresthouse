import { analyzeDependencies } from '../analyzers/import/index.js'
import type { ImportCliOptions } from '../app/args.js'
import { printDependencyTree } from '../output/ascii/import.js'
import { graphToSerializableTree } from '../output/json/import.js'
import type { DependencyGraph } from '../types/dependency-graph.js'
import { BaseCommand } from './base.js'

export class ImportCommand extends BaseCommand<
  DependencyGraph,
  ImportCliOptions
> {
  protected analyze(): DependencyGraph {
    return analyzeDependencies(this.options.entryFile, {
      ...this.getAnalyzeOptions(),
      trackUnusedImports: !this.options.omitUnused,
    })
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
