import { describe, expect, it } from 'vitest'

import { graphToSerializableReactTree } from './react.js'

describe('json react output', () => {
  it('exports the react tree serializer', () => {
    expect(graphToSerializableReactTree).toBeTypeOf('function')
  })
})
