import { expectTypeOf, it } from 'vitest'

import type { PrintPackageTreeOptions } from './print-package-tree-options.js'

it('defines package tree print options', () => {
  expectTypeOf<PrintPackageTreeOptions>().toMatchTypeOf<{
    color?: boolean | 'auto'
  }>()
})
