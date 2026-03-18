import { describe, expect, it } from 'vitest'

import { buildDependencyGraph } from './graph.js'

describe('buildDependencyGraph', () => {
  it('exports a callable graph builder', () => {
    expect(buildDependencyGraph).toBeTypeOf('function')
  })
})
