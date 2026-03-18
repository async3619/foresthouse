export interface AnalyzeOptions {
  readonly cwd?: string
  readonly configPath?: string
  readonly expandWorkspaces?: boolean
  readonly projectOnly?: boolean
  readonly includeBuiltins?: boolean
}
