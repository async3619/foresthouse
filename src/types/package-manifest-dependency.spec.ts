import { expectTypeOf, it } from 'vitest'

import type { PackageManifestDependency } from './package-manifest-dependency.js'

it('models package manifest dependencies', () => {
  expectTypeOf<PackageManifestDependency>().toMatchTypeOf<{
    kind: 'external' | 'workspace'
    name: string
  }>()
})
