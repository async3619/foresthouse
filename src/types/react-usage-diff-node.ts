import type { PackageDependencyChangeKind } from './package-dependency-change-kind.js'
import type { ReactSymbolKind } from './react-symbol-kind.js'
import type { ReactUsageDiffEdge } from './react-usage-diff-edge.js'

export interface ReactUsageDiffNode {
  readonly id: string
  readonly name: string
  readonly symbolKind: ReactSymbolKind
  readonly circular?: boolean
  readonly filePath: string
  readonly change: PackageDependencyChangeKind
  readonly exportNames: readonly string[]
  readonly beforeExportNames?: readonly string[]
  readonly afterExportNames?: readonly string[]
  readonly usages: readonly ReactUsageDiffEdge[]
}
