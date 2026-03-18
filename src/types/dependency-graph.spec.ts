import { expectTypeOf, it } from 'vitest'

import type { DependencyGraph } from './dependency-graph.js'

it('models dependency graphs', () => {
  expectTypeOf<DependencyGraph>().toMatchTypeOf<{
    cwd: string
    entryId: string
  }>()
})
