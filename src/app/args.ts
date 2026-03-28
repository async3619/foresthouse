import type { ReactUsageFilter } from '../types/react-usage-filter.js'

interface BaseCliOptions {
  readonly cwd: string | undefined
  readonly configPath: string | undefined
  readonly expandWorkspaces: boolean
  readonly projectOnly: boolean
  readonly json: boolean
}

export interface ImportCliOptions extends BaseCliOptions {
  readonly command: 'import'
  readonly entryFile: string
  readonly includeExternals: boolean
  readonly omitUnused: boolean
}

export interface DepsCliOptions extends BaseCliOptions {
  readonly command: 'deps'
  readonly directory: string
  readonly diff: string | undefined
}

export interface ReactCliOptions extends BaseCliOptions {
  readonly command: 'react'
  readonly entryFile: string | undefined
  readonly diff: string | undefined
  readonly filter: ReactUsageFilter
  readonly nextjs: boolean
  readonly includeBuiltins: boolean
}

export type CliOptions = DepsCliOptions | ImportCliOptions | ReactCliOptions
