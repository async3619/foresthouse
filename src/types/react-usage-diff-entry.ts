import type { PackageDependencyChangeKind } from './package-dependency-change-kind.js'
import type { ReactUsageDiffNode } from './react-usage-diff-node.js'

export interface ReactUsageDiffEntry {
  readonly key: string
  readonly change: PackageDependencyChangeKind
  readonly targetId: string
  readonly referenceName: string
  readonly beforeReferenceName?: string
  readonly afterReferenceName?: string
  readonly beforeFilePath?: string
  readonly beforeLine?: number
  readonly beforeColumn?: number
  readonly afterFilePath?: string
  readonly afterLine?: number
  readonly afterColumn?: number
  readonly node: ReactUsageDiffNode
}
