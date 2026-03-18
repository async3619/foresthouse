import { describe, expect, it } from 'vitest'

import { printReactUsageTree } from './react.js'

describe('ascii react output', () => {
  it('exports the react usage tree printer', () => {
    expect(printReactUsageTree).toBeTypeOf('function')
  })
})
