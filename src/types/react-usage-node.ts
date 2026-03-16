import type { ReactSymbolKind } from './react-symbol-kind.js'
import type { ReactUsageEdge } from './react-usage-edge.js'

export interface ReactUsageNode {
  readonly id: string
  readonly name: string
  readonly kind: ReactSymbolKind
  readonly filePath: string
  readonly exportNames: readonly string[]
  readonly usages: readonly ReactUsageEdge[]
}
