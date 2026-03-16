import type { PackageDependencyDiffNode } from './package-dependency-diff-node.js'

export interface PackageDependencyDiffGraph {
  readonly repositoryRoot: string
  readonly root: PackageDependencyDiffNode
}
