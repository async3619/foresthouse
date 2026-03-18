import { describe, expect, it } from 'vitest'

import {
  diffGraphToSerializablePackageTree,
  graphToSerializablePackageTree,
} from './deps.js'

describe('json deps output', () => {
  it('exports the deps serializers', () => {
    expect(graphToSerializablePackageTree).toBeTypeOf('function')
    expect(diffGraphToSerializablePackageTree).toBeTypeOf('function')
  })
})
