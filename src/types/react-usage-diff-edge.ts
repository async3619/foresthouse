import type { PackageDependencyChangeKind } from './package-dependency-change-kind.js'
import type { ReactUsageDiffNode } from './react-usage-diff-node.js'
import type { ReactUsageEdgeKind } from './react-usage-edge-kind.js'

export interface ReactUsageDiffEdge {
  readonly key: string
  readonly kind: ReactUsageEdgeKind
  readonly change: PackageDependencyChangeKind
  readonly targetId: string
  readonly referenceName: string
  readonly beforeReferenceName?: string
  readonly afterReferenceName?: string
  readonly node: ReactUsageDiffNode
}
