import path from 'node:path'
import { bench, describe } from 'vitest'
import { analyzeReactUsage } from './index.js'

const fixturesDir = path.resolve(import.meta.dirname, '../../../test/fixtures')

describe('analyzeReactUsage', () => {
  bench('react-mode fixture', () => {
    analyzeReactUsage('src/main.tsx', {
      cwd: path.join(fixturesDir, 'react-mode'),
    })
  })

  bench('react-mode entry-page fixture', () => {
    analyzeReactUsage('src/entry-page.tsx', {
      cwd: path.join(fixturesDir, 'react-mode'),
    })
  })
})
