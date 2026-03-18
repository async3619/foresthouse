import { expectTypeOf, it } from 'vitest'

import type { DependencyKind } from './dependency-kind.js'

it('defines dependency node kinds', () => {
  expectTypeOf<DependencyKind>().toEqualTypeOf<
    'source' | 'external' | 'builtin' | 'missing' | 'boundary'
  >()
})
