import type { PackageDependencyChangeKind } from './package-dependency-change-kind.js'
import type { PackageDependencyDiffNode } from './package-dependency-diff-node.js'

export interface PackageDependencyDiffState {
  readonly target: string
  readonly specifier?: string
}

interface BasePackageDependencyDiffDependency {
  readonly name: string
  readonly change: PackageDependencyChangeKind
  readonly before?: PackageDependencyDiffState
  readonly after?: PackageDependencyDiffState
}

export interface ExternalPackageDependencyDiff
  extends BasePackageDependencyDiffDependency {
  readonly kind: 'external'
}

export interface WorkspacePackageDependencyDiff
  extends BasePackageDependencyDiffDependency {
  readonly kind: 'workspace'
  readonly propagated: boolean
  readonly node: PackageDependencyDiffNode
}

export type PackageDependencyDiffDependency =
  | ExternalPackageDependencyDiff
  | WorkspacePackageDependencyDiff
