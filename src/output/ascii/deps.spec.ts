import { describe, expect, it } from 'vitest'

import {
  printPackageDependencyDiffTree,
  printPackageDependencyTree,
} from './deps.js'

describe('ascii deps output', () => {
  it('exports dependency tree printers', () => {
    expect(printPackageDependencyTree).toBeTypeOf('function')
    expect(printPackageDependencyDiffTree).toBeTypeOf('function')
  })
})
