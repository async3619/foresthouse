import { ResolverFactory } from 'oxc-resolver'
import { describe, expect, it } from 'vitest'

import { resolveDependency } from './resolver.js'

describe('resolveDependency', () => {
  it('classifies builtin modules without filesystem resolution', () => {
    expect(
      resolveDependency(
        {
          specifier: 'node:path',
          referenceKind: 'import',
          isTypeOnly: false,
          unused: false,
        },
        '/repo/src/main.ts',
        {
          cwd: '/repo',
          expandWorkspaces: true,
          projectOnly: false,
          getConfigForFile: () => ({ compilerOptions: {} }),
          getResolverForFile: () =>
            new ResolverFactory({ builtinModules: true }),
        },
      ),
    ).toMatchObject({
      kind: 'builtin',
      target: 'node:path',
    })
  })
})
