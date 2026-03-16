import type { ReactUsageFilter } from '../types/react-usage-filter.js'

export interface CliOptions {
  readonly entryFile: string
  readonly cwd: string | undefined
  readonly configPath: string | undefined
  readonly includeExternals: boolean
  readonly omitUnused: boolean
  readonly json: boolean
  readonly react: ReactUsageFilter | undefined
}
