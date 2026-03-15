export type DependencyKind = 'source' | 'external' | 'builtin' | 'missing'

export type ReferenceKind =
  | 'import'
  | 'export'
  | 'require'
  | 'dynamic-import'
  | 'import-equals'

export interface DependencyEdge {
  readonly specifier: string
  readonly referenceKind: ReferenceKind
  readonly isTypeOnly: boolean
  readonly kind: DependencyKind
  readonly target: string
}

export interface SourceModuleNode {
  readonly id: string
  readonly dependencies: readonly DependencyEdge[]
}

export interface DependencyGraph {
  readonly cwd: string
  readonly entryId: string
  readonly nodes: ReadonlyMap<string, SourceModuleNode>
  readonly configPath?: string
}

export interface AnalyzeOptions {
  readonly cwd?: string
  readonly configPath?: string
}

export interface PrintTreeOptions {
  readonly cwd?: string
  readonly includeExternals?: boolean
}

export type ReactSymbolKind = 'component' | 'hook'

export type ReactUsageFilter = 'all' | ReactSymbolKind

export type ReactUsageEdgeKind = 'render' | 'hook-call'

export interface ReactUsageEdge {
  readonly kind: ReactUsageEdgeKind
  readonly target: string
}

export interface ReactUsageNode {
  readonly id: string
  readonly name: string
  readonly kind: ReactSymbolKind
  readonly filePath: string
  readonly exportNames: readonly string[]
  readonly usages: readonly ReactUsageEdge[]
}

export interface ReactUsageGraph {
  readonly cwd: string
  readonly entryId: string
  readonly nodes: ReadonlyMap<string, ReactUsageNode>
}

export interface PrintReactTreeOptions {
  readonly cwd?: string
  readonly filter?: ReactUsageFilter
}
