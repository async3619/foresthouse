import { describe, expect, it } from 'vitest'

import { analyzeReactFile } from './file.js'

describe('analyzeReactFile', () => {
  it('exports a callable file analyzer', () => {
    expect(analyzeReactFile).toBeTypeOf('function')
  })
})
