import { expectTypeOf, it } from 'vitest'

import type { ReactUsageGraph } from './react-usage-graph.js'

it('models react usage graphs', () => {
  expectTypeOf<ReactUsageGraph>().toMatchTypeOf<{
    cwd: string
    entryId: string
    entryIds: readonly string[]
  }>()
})
