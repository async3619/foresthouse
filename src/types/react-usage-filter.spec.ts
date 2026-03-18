import { expectTypeOf, it } from 'vitest'

import type { ReactUsageFilter } from './react-usage-filter.js'

it('defines react usage filters', () => {
  expectTypeOf<ReactUsageFilter>().toEqualTypeOf<
    'all' | 'component' | 'hook' | 'builtin'
  >()
})
