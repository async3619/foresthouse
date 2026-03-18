import { expectTypeOf, it } from 'vitest'

import type { PackageDependencyDiffNode } from './package-dependency-diff-node.js'

it('models package dependency diff nodes', () => {
  expectTypeOf<PackageDependencyDiffNode>().toMatchTypeOf<{
    kind: 'root' | 'workspace' | 'circular'
    label: string
    packageName: string
  }>()
})
