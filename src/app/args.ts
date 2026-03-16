import type { ReactUsageFilter } from '../types/react-usage-filter.js'

interface BaseCliOptions {
  readonly entryFile: string
  readonly cwd: string | undefined
  readonly configPath: string | undefined
  readonly expandWorkspaces: boolean
  readonly projectOnly: boolean
  readonly json: boolean
}

export interface ImportCliOptions extends BaseCliOptions {
  readonly command: 'import'
  readonly includeExternals: boolean
  readonly omitUnused: boolean
}

export interface ReactCliOptions extends BaseCliOptions {
  readonly command: 'react'
  readonly filter: ReactUsageFilter
  readonly includeBuiltins: boolean
}

export type CliOptions = ImportCliOptions | ReactCliOptions
