import { describe, expect, it } from 'vitest'

import { analyzePackageDependencyDiff } from './diff.js'

describe('analyzePackageDependencyDiff', () => {
  it('exports a callable diff analyzer', () => {
    expect(analyzePackageDependencyDiff).toBeTypeOf('function')
  })
})
