import { expectTypeOf, it } from 'vitest'

import type { ReactUsageEdgeKind } from './react-usage-edge-kind.js'

it('defines react usage edge kinds', () => {
  expectTypeOf<ReactUsageEdgeKind>().toEqualTypeOf<'render' | 'hook-call'>()
})
