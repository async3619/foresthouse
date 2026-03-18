import { expectTypeOf, it } from 'vitest'

import type { ReactUsageLocation } from './react-usage-location.js'

it('models source locations', () => {
  expectTypeOf<ReactUsageLocation>().toMatchTypeOf<{
    filePath: string
    line: number
    column: number
  }>()
})
