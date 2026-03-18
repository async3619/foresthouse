import type { PackageDependencyNode } from './package-dependency-node.js'

export interface PackageDependencyGraph {
  readonly repositoryRoot: string
  readonly rootId: string
  readonly nodes: ReadonlyMap<string, PackageDependencyNode>
}
