import { expectTypeOf, it } from 'vitest'

import type { DependencyEdge } from './dependency-edge.js'

it('models dependency graph edges', () => {
  expectTypeOf<DependencyEdge>().toMatchTypeOf<{
    specifier: string
    target: string
    unused: boolean
  }>()
})
