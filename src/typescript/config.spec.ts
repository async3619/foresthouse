import { describe, expect, it } from 'vitest'

import { loadCompilerOptions } from './config.js'

describe('loadCompilerOptions', () => {
  it('exports the tsconfig loader', () => {
    expect(loadCompilerOptions).toBeTypeOf('function')
  })
})
