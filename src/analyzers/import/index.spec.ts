import { describe, expect, it } from 'vitest'

import { analyzeDependencies } from './index.js'

describe('analyzeDependencies', () => {
  it('exports a callable dependency analyzer', () => {
    expect(analyzeDependencies).toBeTypeOf('function')
  })
})
