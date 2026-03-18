import { expectTypeOf, it } from 'vitest'

import type { PackageDependencyNode } from './package-dependency-node.js'

it('models package dependency nodes', () => {
  expectTypeOf<PackageDependencyNode>().toMatchTypeOf<{
    packageDir: string
    packageName: string
  }>()
})
