import { expectTypeOf, it } from 'vitest'

import type { PackageDependencyGraph } from './package-dependency-graph.js'

it('models package dependency graphs', () => {
  expectTypeOf<PackageDependencyGraph>().toMatchTypeOf<{
    repositoryRoot: string
    rootId: string
  }>()
})
