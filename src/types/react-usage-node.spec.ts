import { expectTypeOf, it } from 'vitest'

import type { ReactUsageNode } from './react-usage-node.js'

it('models react usage nodes', () => {
  expectTypeOf<ReactUsageNode>().toMatchTypeOf<{
    id: string
    name: string
    filePath: string
  }>()
})
