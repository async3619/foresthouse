import { expectTypeOf, it } from 'vitest'

import type { PackageDependencyDiffGraph } from './package-dependency-diff-graph.js'

it('models package dependency diff graphs', () => {
  expectTypeOf<PackageDependencyDiffGraph>().toMatchTypeOf<{
    repositoryRoot: string
  }>()
})
