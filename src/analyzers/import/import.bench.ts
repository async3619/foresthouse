import path from 'node:path'
import { bench, describe } from 'vitest'
import { analyzeDependencies } from './index.js'

const fixturesDir = path.resolve(import.meta.dirname, '../../../test/fixtures')

describe('analyzeDependencies', () => {
  bench('basic fixture', () => {
    analyzeDependencies('src/main.ts', {
      cwd: path.join(fixturesDir, 'basic'),
    })
  })

  bench('basic fixture with project-only', () => {
    analyzeDependencies('src/main.ts', {
      cwd: path.join(fixturesDir, 'basic'),
      projectOnly: true,
    })
  })

  bench('monorepo fixture', () => {
    analyzeDependencies('src/main.ts', {
      cwd: path.join(fixturesDir, 'monorepo', 'packages', 'app'),
    })
  })

  bench('monorepo fixture without workspace expansion', () => {
    analyzeDependencies('src/main.ts', {
      cwd: path.join(fixturesDir, 'monorepo', 'packages', 'app'),
      expandWorkspaces: false,
    })
  })
})
