import type { ReactUsageDiffEntry } from './react-usage-diff-entry.js'
import type { ReactUsageDiffNode } from './react-usage-diff-node.js'

export interface ReactUsageDiffGraph {
  readonly kind: 'react-usage-diff'
  readonly repositoryRoot: string
  readonly cwd: string
  readonly entries: readonly ReactUsageDiffEntry[]
  readonly roots: readonly ReactUsageDiffNode[]
}
