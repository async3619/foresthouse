import { describe, expect, it } from 'vitest'

import { DepsCommand } from './deps.js'

describe('DepsCommand', () => {
  it('exports the deps command class', () => {
    expect(DepsCommand).toBeTypeOf('function')
  })
})
