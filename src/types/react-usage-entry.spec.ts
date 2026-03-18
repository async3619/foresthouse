import { expectTypeOf, it } from 'vitest'

import type { ReactUsageEntry } from './react-usage-entry.js'

it('models react usage entries', () => {
  expectTypeOf<ReactUsageEntry>().toMatchTypeOf<{
    target: string
    referenceName: string
  }>()
})
