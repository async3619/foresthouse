import type { PackageDependencyChangeKind } from './package-dependency-change-kind.js'
import type { PackageDependencyDiffNode } from './package-dependency-diff-node.js'

export interface PackageDependencyDiffState {
  readonly target: string
  readonly specifier?: string
  readonly resolvedVersion?: string
  readonly peerContext?: string
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
  readonly specifierChanged: boolean
  readonly resolvedVersionChanged: boolean
  readonly peerContextChanged: boolean
}

export interface WorkspacePackageDependencyDiff
  extends BasePackageDependencyDiffDependency {
  readonly kind: 'workspace'
  readonly node: PackageDependencyDiffNode
}

export type PackageDependencyDiffDependency =
  | ExternalPackageDependencyDiff
  | WorkspacePackageDependencyDiff
