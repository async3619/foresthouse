import type { DependencyKind } from './dependency-kind.js'
import type { ReferenceKind } from './reference-kind.js'

export interface DependencyEdge {
  readonly specifier: string
  readonly referenceKind: ReferenceKind
  readonly isTypeOnly: boolean
  readonly unused: boolean
  readonly kind: DependencyKind
  readonly target: string
}
