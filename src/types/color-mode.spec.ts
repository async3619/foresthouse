import { expectTypeOf, it } from 'vitest'

import type { ColorMode } from './color-mode.js'

it('defines supported color modes', () => {
  expectTypeOf<ColorMode>().toEqualTypeOf<boolean | 'auto'>()
})
