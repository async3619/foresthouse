import { expectTypeOf, it } from 'vitest'

import type { PrintReactTreeOptions } from './print-react-tree-options.js'

it('defines react tree print options', () => {
  expectTypeOf<PrintReactTreeOptions>().toMatchTypeOf<{
    cwd?: string
    color?: boolean | 'auto'
  }>()
})
