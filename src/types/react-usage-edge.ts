import type { ReactUsageEdgeKind } from './react-usage-edge-kind.js'

export interface ReactUsageEdge {
  readonly kind: ReactUsageEdgeKind
  readonly target: string
  readonly referenceName: string
}
