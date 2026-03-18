import { expectTypeOf, it } from 'vitest'

import type { ReactUsageEdge } from './react-usage-edge.js'

it('models react usage edges', () => {
  expectTypeOf<ReactUsageEdge>().toMatchTypeOf<{
    target: string
    referenceName: string
  }>()
})
