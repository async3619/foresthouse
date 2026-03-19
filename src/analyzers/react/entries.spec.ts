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

  it('resolves later lines and columns without rescanning semantics regressions', () => {
    const sourceText = ['const one = 1;', 'const two = 2;', 'return two;'].join(
      '\n',
    )

    expect(
      createReactUsageLocation(
        'src/App.tsx',
        sourceText,
        sourceText.indexOf('two'),
      ),
    ).toEqual({
      filePath: 'src/App.tsx',
      line: 2,
      column: 7,
    })

    expect(
      createReactUsageLocation(
        'src/App.tsx',
        sourceText,
        sourceText.indexOf('return'),
      ),
    ).toEqual({
      filePath: 'src/App.tsx',
      line: 3,
      column: 1,
    })
  })

  it('clamps offsets beyond the end of the source text', () => {
    expect(createReactUsageLocation('src/App.tsx', 'abc', 99)).toEqual({
      filePath: 'src/App.tsx',
      line: 1,
      column: 4,
    })
  })
})
