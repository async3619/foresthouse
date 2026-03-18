import { describe, expect, it } from 'vitest'

import { analyzePackageDependencies } from './index.js'

describe('analyzePackageDependencies', () => {
  it('exports a callable package analyzer', () => {
    expect(analyzePackageDependencies).toBeTypeOf('function')
  })
})
