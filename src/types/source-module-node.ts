import type { DependencyEdge } from './dependency-edge.js'

export interface SourceModuleNode {
  readonly id: string
  readonly dependencies: readonly DependencyEdge[]
}
