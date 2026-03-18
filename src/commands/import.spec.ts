import { describe, expect, it } from 'vitest'

import { ImportCommand } from './import.js'

describe('ImportCommand', () => {
  it('exports the import command class', () => {
    expect(ImportCommand).toBeTypeOf('function')
  })
})
