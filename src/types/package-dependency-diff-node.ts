import type { PackageDependencyChangeKind } from './package-dependency-change-kind.js'
import type { PackageDependencyDiffDependency } from './package-dependency-diff-dependency.js'

export interface PackageDependencyDiffNode {
  readonly kind: 'root' | 'workspace' | 'circular'
  readonly label: string
  readonly packageName: string
  readonly path: string
  readonly change: PackageDependencyChangeKind
  readonly beforePackageName?: string
  readonly afterPackageName?: string
  readonly dependencies: readonly PackageDependencyDiffDependency[]
}
