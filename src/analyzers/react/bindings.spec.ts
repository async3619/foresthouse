import { describe, expect, it } from 'vitest'

import { collectImportsAndExports } from './bindings.js'

describe('collectImportsAndExports', () => {
  it('exports a callable bindings collector', () => {
    expect(collectImportsAndExports).toBeTypeOf('function')
  })
})
