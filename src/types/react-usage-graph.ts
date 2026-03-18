import type { ReactUsageEntry } from './react-usage-entry.js'
import type { ReactUsageNode } from './react-usage-node.js'

export interface ReactUsageGraph {
  readonly cwd: string
  readonly entryId: string
  readonly entryIds: readonly string[]
  readonly nodes: ReadonlyMap<string, ReactUsageNode>
  readonly entries: readonly ReactUsageEntry[]
}
