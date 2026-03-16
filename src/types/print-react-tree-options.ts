import type { ColorMode } from './color-mode.js'
import type { ReactUsageFilter } from './react-usage-filter.js'

export interface PrintReactTreeOptions {
  readonly cwd?: string
  readonly filter?: ReactUsageFilter
  readonly color?: ColorMode
}
