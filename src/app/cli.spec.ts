import { describe, expect, it } from 'vitest'

import { main } from './cli.js'

describe('main', () => {
  it('exports the CLI entry function', () => {
    expect(main).toBeTypeOf('function')
  })
})
