import { expectTypeOf, it } from 'vitest'

import type { ReferenceKind } from './reference-kind.js'

it('defines import reference kinds', () => {
  expectTypeOf<ReferenceKind>().toEqualTypeOf<
    'import' | 'export' | 'require' | 'dynamic-import' | 'import-equals'
  >()
})
