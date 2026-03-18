import { describe, expect, it } from 'vitest'

import { printDependencyTree } from './import.js'

describe('ascii import output', () => {
  it('exports the dependency tree printer', () => {
    expect(printDependencyTree).toBeTypeOf('function')
  })
})
