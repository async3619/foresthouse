import path from 'node:path'
import { bench, describe } from 'vitest'
import { analyzePackageDependencies } from './index.js'

const fixturesDir = path.resolve(import.meta.dirname, '../../../test/fixtures')

describe('analyzePackageDependencies', () => {
  bench('single package', () => {
    analyzePackageDependencies(path.join(fixturesDir, 'deps-single'))
  })

  bench('monorepo', () => {
    analyzePackageDependencies(
      path.join(fixturesDir, 'deps-monorepo', 'apps', 'web'),
    )
  })

  bench('pnpm monorepo', () => {
    analyzePackageDependencies(
      path.join(fixturesDir, 'deps-pnpm-monorepo', 'apps', 'web'),
    )
  })
})
