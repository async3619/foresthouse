import { describe, expect, it } from 'vitest'

import * as index from './index.js'

describe('package index', () => {
  it('re-exports the public runtime entrypoints', () => {
    expect(index.analyzeDependencies).toBeTypeOf('function')
    expect(index.analyzeReactUsage).toBeTypeOf('function')
    expect(index.analyzePackageDependencies).toBeTypeOf('function')
    expect(index.printDependencyTree).toBeTypeOf('function')
  })
})
