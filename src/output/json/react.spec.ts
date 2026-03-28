import { describe, expect, it } from 'vitest'

import {
  diffGraphToSerializableReactTree,
  graphToSerializableReactTree,
} from './react.js'

describe('json react output', () => {
  it('exports the react tree serializer', () => {
    expect(graphToSerializableReactTree).toBeTypeOf('function')
    expect(diffGraphToSerializableReactTree).toBeTypeOf('function')
  })
})
