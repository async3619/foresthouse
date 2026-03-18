import type { SourceModuleNode } from './source-module-node.js'

export interface DependencyGraph {
  readonly cwd: string
  readonly entryId: string
  readonly nodes: ReadonlyMap<string, SourceModuleNode>
  readonly configPath?: string
}
