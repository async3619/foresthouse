import { expectTypeOf, it } from 'vitest'

import type { PackageDependencyChangeKind } from './package-dependency-change-kind.js'

it('defines package dependency diff states', () => {
  expectTypeOf<PackageDependencyChangeKind>().toEqualTypeOf<
    'added' | 'removed' | 'changed' | 'unchanged'
  >()
})
