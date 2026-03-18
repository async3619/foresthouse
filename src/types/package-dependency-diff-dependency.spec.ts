import { expectTypeOf, it } from 'vitest'

import type { PackageDependencyDiffDependency } from './package-dependency-diff-dependency.js'

it('models diff dependencies', () => {
  expectTypeOf<PackageDependencyDiffDependency>().toMatchTypeOf<{
    name: string
    change: 'added' | 'removed' | 'changed' | 'unchanged'
  }>()
})
