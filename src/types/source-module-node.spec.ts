import { expectTypeOf, it } from 'vitest'

import type { SourceModuleNode } from './source-module-node.js'

it('models source module nodes', () => {
  expectTypeOf<SourceModuleNode>().toMatchTypeOf<{
    id: string
  }>()
})
