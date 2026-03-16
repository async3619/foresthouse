import type { ColorMode } from './color-mode.js'

export interface PrintTreeOptions {
  readonly cwd?: string
  readonly includeExternals?: boolean
  readonly omitUnused?: boolean
  readonly color?: ColorMode
}
