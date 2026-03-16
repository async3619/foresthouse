import { analyzePackageDependencyDiff } from '../analyzers/deps/diff.js'
import { analyzePackageDependencies } from '../analyzers/deps/index.js'
import type { DepsCliOptions } from '../app/args.js'
import {
  printPackageDependencyDiffTree,
  printPackageDependencyTree,
} from '../output/ascii/deps.js'
import {
  diffGraphToSerializablePackageTree,
  graphToSerializablePackageTree,
} from '../output/json/deps.js'
import type { PackageDependencyDiffGraph } from '../types/package-dependency-diff-graph.js'
import type { PackageDependencyGraph } from '../types/package-dependency-graph.js'
import { BaseCommand } from './base.js'

export class DepsCommand extends BaseCommand<
  PackageDependencyGraph | PackageDependencyDiffGraph,
  DepsCliOptions
> {
  protected analyze(): PackageDependencyGraph | PackageDependencyDiffGraph {
    if (this.options.diff !== undefined) {
      return analyzePackageDependencyDiff(
        this.options.directory,
        this.options.diff,
      )
    }

    return analyzePackageDependencies(this.options.directory)
  }

  protected serialize(
    graph: PackageDependencyGraph | PackageDependencyDiffGraph,
  ): object {
    if (isPackageDependencyDiffGraph(graph)) {
      return diffGraphToSerializablePackageTree(graph)
    }

    return graphToSerializablePackageTree(graph)
  }

  protected render(
    graph: PackageDependencyGraph | PackageDependencyDiffGraph,
  ): string {
    if (isPackageDependencyDiffGraph(graph)) {
      return printPackageDependencyDiffTree(graph)
    }

    return printPackageDependencyTree(graph)
  }
}

function isPackageDependencyDiffGraph(
  graph: PackageDependencyGraph | PackageDependencyDiffGraph,
): graph is PackageDependencyDiffGraph {
  return 'root' in graph
}
