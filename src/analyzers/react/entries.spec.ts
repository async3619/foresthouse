import { describe, expect, it } from 'vitest'

import { collectEntryUsages, createReactUsageLocation } from './entries.js'

describe('react entry helpers', () => {
  it('exports entry collection helpers', () => {
    expect(collectEntryUsages).toBeTypeOf('function')
    expect(createReactUsageLocation('src/App.tsx', '<App />', 0)).toEqual({
      filePath: 'src/App.tsx',
      line: 1,
      column: 1,
    })
  })
})
