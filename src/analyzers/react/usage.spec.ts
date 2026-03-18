import { describe, expect, it } from 'vitest'

import { analyzeSymbolUsages } from './usage.js'

describe('analyzeSymbolUsages', () => {
  it('exports a callable usage analyzer', () => {
    expect(analyzeSymbolUsages).toBeTypeOf('function')
  })
})
