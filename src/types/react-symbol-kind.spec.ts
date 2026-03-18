import { expectTypeOf, it } from 'vitest'

import type { ReactSymbolKind } from './react-symbol-kind.js'

it('defines react symbol kinds', () => {
  expectTypeOf<ReactSymbolKind>().toEqualTypeOf<
    'component' | 'hook' | 'builtin'
  >()
})
