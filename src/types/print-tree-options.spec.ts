import { expectTypeOf, it } from 'vitest'

import type { PrintTreeOptions } from './print-tree-options.js'

it('defines import tree print options', () => {
  expectTypeOf<PrintTreeOptions>().toMatchTypeOf<{
    cwd?: string
    includeExternals?: boolean
    omitUnused?: boolean
  }>()
})
