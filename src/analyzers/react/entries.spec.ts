import { parseSync } from 'oxc-parser'
import { describe, expect, it } from 'vitest'

import { collectEntryUsages, createReactUsageLocation } from './entries.js'

describe('createReactUsageLocation', () => {
  it('returns line 1 column 1 for offset 0', () => {
    expect(createReactUsageLocation('src/App.tsx', '<App />', 0)).toEqual({
      filePath: 'src/App.tsx',
      line: 1,
      column: 1,
    })
  })

  it('resolves later lines and columns correctly', () => {
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

  it('clamps negative offsets to 0', () => {
    expect(createReactUsageLocation('src/App.tsx', 'abc', -5)).toEqual({
      filePath: 'src/App.tsx',
      line: 1,
      column: 1,
    })
  })

  it('handles empty source text', () => {
    expect(createReactUsageLocation('src/App.tsx', '', 0)).toEqual({
      filePath: 'src/App.tsx',
      line: 1,
      column: 1,
    })
  })
})

describe('collectEntryUsages', () => {
  it('finds top-level component JSX usage', () => {
    const code = '<App />'
    const { program } = parseSync('test.tsx', code)
    const entries = collectEntryUsages(program, '/test.tsx', code, false)

    expect(entries).toHaveLength(1)
    const entry0 = entries[0] as (typeof entries)[0]
    expect(entry0.referenceName).toBe('App')
    expect(entry0.kind).toBe('component')
  })

  it('finds hook calls at top level', () => {
    const code = 'useEffect(() => {}, [])'
    const { program } = parseSync('test.tsx', code)
    const entries = collectEntryUsages(program, '/test.tsx', code, false)

    expect(entries).toHaveLength(1)
    const hookEntry = entries[0] as (typeof entries)[0]
    expect(hookEntry.referenceName).toBe('useEffect')
    expect(hookEntry.kind).toBe('hook')
  })

  it('includes builtin elements when includeBuiltins is true', () => {
    const code = '<div />'
    const { program } = parseSync('test.tsx', code)
    const entries = collectEntryUsages(program, '/test.tsx', code, true)

    expect(entries.some((e) => e.referenceName === 'div')).toBe(true)
  })

  it('excludes builtin elements when includeBuiltins is false', () => {
    const code = '<div />'
    const { program } = parseSync('test.tsx', code)
    const entries = collectEntryUsages(program, '/test.tsx', code, false)

    expect(entries.some((e) => e.referenceName === 'div')).toBe(false)
  })

  it('does not collect usages inside function bodies', () => {
    const code = 'function render() { return <App /> }'
    const { program } = parseSync('test.tsx', code)
    const entries = collectEntryUsages(program, '/test.tsx', code, false)

    expect(entries).toHaveLength(0)
  })

  it('deduplicates entries by location', () => {
    const code = '<App />'
    const { program } = parseSync('test.tsx', code)
    const entries = collectEntryUsages(program, '/test.tsx', code, false)

    expect(entries).toHaveLength(1)
  })

  it('does not create separate entries for nested components', () => {
    const code = '<Parent><Child /></Parent>'
    const { program } = parseSync('test.tsx', code)
    const entries = collectEntryUsages(program, '/test.tsx', code, false)

    const parentEntry = entries.find((e) => e.referenceName === 'Parent')
    const childEntry = entries.find((e) => e.referenceName === 'Child')
    expect(parentEntry).toBeDefined()
    expect(childEntry).toBeUndefined()
  })

  it('sorts multiple entries by location', () => {
    const code = '<App />;\n<Other />;'
    const { program } = parseSync('test.tsx', code)
    const entries = collectEntryUsages(program, '/test.tsx', code, false)

    expect(entries.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1] as (typeof entries)[0]
      const curr = entries[i] as (typeof entries)[0]
      expect(prev.location.line).toBeLessThanOrEqual(curr.location.line)
    }
  })

  it('finds member expression component references', () => {
    const code = '<Ns.Item />'
    const { program } = parseSync('test.tsx', code)
    const entries = collectEntryUsages(program, '/test.tsx', code, false)

    expect(entries.some((e) => e.referenceName === 'Ns.Item')).toBe(true)
  })

  it('finds React.createElement component references', () => {
    const code = 'React.createElement(MyComp, null)'
    const { program } = parseSync('test.tsx', code)
    const entries = collectEntryUsages(program, '/test.tsx', code, false)

    expect(entries.some((e) => e.referenceName === 'MyComp')).toBe(true)
  })
})
