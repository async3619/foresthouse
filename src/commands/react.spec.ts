import { describe, expect, it } from 'vitest'

import { ReactCommand } from './react.js'

describe('ReactCommand', () => {
  it('exports the react command class', () => {
    expect(ReactCommand).toBeTypeOf('function')
  })
})
