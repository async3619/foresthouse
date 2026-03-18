import { describe, expect, it } from 'vitest'

import { graphToSerializableTree } from './import.js'

describe('json import output', () => {
  it('exports the import tree serializer', () => {
    expect(graphToSerializableTree).toBeTypeOf('function')
  })
})
