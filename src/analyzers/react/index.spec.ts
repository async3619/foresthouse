import { describe, expect, it } from 'vitest'

import { analyzeReactUsage } from './index.js'

describe('analyzeReactUsage', () => {
  it('exports a callable react analyzer', () => {
    expect(analyzeReactUsage).toBeTypeOf('function')
  })
})
