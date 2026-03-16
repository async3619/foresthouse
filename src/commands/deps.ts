import { analyzePackageDependencies } from '../analyzers/deps/index.js'
import type { DepsCliOptions } from '../app/args.js'
import { printPackageDependencyTree } from '../output/ascii/deps.js'
import { graphToSerializablePackageTree } from '../output/json/deps.js'
import type { PackageDependencyGraph } from '../types/package-dependency-graph.js'
import { BaseCommand } from './base.js'

export class DepsCommand extends BaseCommand<
  PackageDependencyGraph,
  DepsCliOptions
> {
  protected analyze(): PackageDependencyGraph {
    return analyzePackageDependencies(this.options.directory)
  }

  protected serialize(graph: PackageDependencyGraph): object {
    return graphToSerializablePackageTree(graph)
  }

  protected render(graph: PackageDependencyGraph): string {
    return printPackageDependencyTree(graph)
  }
}
