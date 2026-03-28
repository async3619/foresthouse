import { describe, expect, it } from 'vitest'

import {
  colorizeMuted,
  colorizePackageDiff,
  colorizeReactLabel,
  colorizeUnusedMarker,
  formatReactSymbolLabel,
  formatReactSymbolName,
  resolveColorSupport,
} from './color.js'

describe('resolveColorSupport', () => {
  it('returns true when mode is true', () => {
    expect(resolveColorSupport(true)).toBe(true)
  })

  it('returns false when mode is false', () => {
    expect(resolveColorSupport(false)).toBe(false)
  })

  it('uses FORCE_COLOR when auto', () => {
    expect(resolveColorSupport('auto', { forceColor: '1' })).toBe(true)
    expect(resolveColorSupport('auto', { forceColor: '0' })).toBe(false)
    expect(resolveColorSupport('auto', { forceColor: 'true' })).toBe(true)
  })

  it('returns false when NO_COLOR is set', () => {
    expect(
      resolveColorSupport('auto', {
        forceColor: undefined,
        noColor: '1',
      }),
    ).toBe(false)
    expect(
      resolveColorSupport('auto', {
        forceColor: undefined,
        noColor: '',
      }),
    ).toBe(false)
  })

  it('falls back to TTY detection', () => {
    expect(
      resolveColorSupport('auto', {
        forceColor: undefined,
        noColor: undefined,
        isTTY: true,
      }),
    ).toBe(true)
    expect(
      resolveColorSupport('auto', {
        forceColor: undefined,
        noColor: undefined,
        isTTY: false,
      }),
    ).toBe(false)
    expect(
      resolveColorSupport('auto', {
        forceColor: undefined,
        noColor: undefined,
        isTTY: undefined,
      }),
    ).toBe(false)
  })

  it('FORCE_COLOR takes precedence over NO_COLOR', () => {
    expect(
      resolveColorSupport('auto', {
        forceColor: '1',
        noColor: '1',
      }),
    ).toBe(true)
  })
})

describe('colorizeUnusedMarker', () => {
  it('wraps (unused) with ANSI when enabled', () => {
    expect(colorizeUnusedMarker('src/file.ts (unused)', true)).toBe(
      'src/file.ts \u001B[38;5;214m(unused)\u001B[0m',
    )
  })

  it('returns text unchanged when disabled', () => {
    expect(colorizeUnusedMarker('src/file.ts (unused)', false)).toBe(
      'src/file.ts (unused)',
    )
  })

  it('handles text without (unused)', () => {
    expect(colorizeUnusedMarker('src/file.ts', true)).toBe('src/file.ts')
  })

  it('replaces multiple occurrences', () => {
    const result = colorizeUnusedMarker('(unused) and (unused)', true)
    expect(result).toContain('\u001B[38;5;214m(unused)\u001B[0m')
    expect(result.split('\u001B[38;5;214m').length).toBe(3)
  })
})

describe('formatReactSymbolName', () => {
  it('formats component names with angle brackets', () => {
    expect(formatReactSymbolName('App', 'component')).toBe('<App />')
  })

  it('formats hook names with parentheses', () => {
    expect(formatReactSymbolName('useState', 'hook')).toBe('useState()')
  })

  it('formats builtin names with angle brackets (no self-close)', () => {
    expect(formatReactSymbolName('div', 'builtin')).toBe('<div>')
  })
})

describe('formatReactSymbolLabel', () => {
  it('formats with kind suffix when disabled', () => {
    expect(formatReactSymbolLabel('App', 'component', false)).toBe(
      '<App /> [component]',
    )
    expect(formatReactSymbolLabel('useState', 'hook', false)).toBe(
      'useState() [hook]',
    )
    expect(formatReactSymbolLabel('div', 'builtin', false)).toBe(
      '<div> [builtin]',
    )
  })

  it('wraps with ANSI color when enabled', () => {
    expect(formatReactSymbolLabel('App', 'component', true)).toBe(
      '\u001B[36m<App /> [component]\u001B[0m',
    )
    expect(formatReactSymbolLabel('useState', 'hook', true)).toBe(
      '\u001B[35museState() [hook]\u001B[0m',
    )
    expect(formatReactSymbolLabel('div', 'builtin', true)).toBe(
      '\u001B[34m<div> [builtin]\u001B[0m',
    )
  })
})

describe('colorizeReactLabel', () => {
  it('returns text unchanged when disabled', () => {
    expect(colorizeReactLabel('test', 'component', false)).toBe('test')
  })

  it('wraps with component color when enabled', () => {
    expect(colorizeReactLabel('test', 'component', true)).toBe(
      '\u001B[36mtest\u001B[0m',
    )
  })

  it('wraps with hook color when enabled', () => {
    expect(colorizeReactLabel('test', 'hook', true)).toBe(
      '\u001B[35mtest\u001B[0m',
    )
  })

  it('wraps with builtin color when enabled', () => {
    expect(colorizeReactLabel('test', 'builtin', true)).toBe(
      '\u001B[34mtest\u001B[0m',
    )
  })
})

describe('colorizeMuted', () => {
  it('returns text unchanged when disabled', () => {
    expect(colorizeMuted('faded text', false)).toBe('faded text')
  })

  it('wraps with muted color when enabled', () => {
    expect(colorizeMuted('faded text', true)).toBe(
      '\u001B[38;5;244mfaded text\u001B[0m',
    )
  })
})

describe('colorizePackageDiff', () => {
  it('returns text unchanged when disabled', () => {
    expect(colorizePackageDiff('+ added', 'added', false)).toBe('+ added')
  })

  it('uses green for added', () => {
    expect(colorizePackageDiff('+ added', 'added', true)).toBe(
      '\u001B[32m+ added\u001B[0m',
    )
  })

  it('uses red for removed', () => {
    expect(colorizePackageDiff('- removed', 'removed', true)).toBe(
      '\u001B[31m- removed\u001B[0m',
    )
  })

  it('uses yellow for changed', () => {
    expect(colorizePackageDiff('~ changed', 'changed', true)).toBe(
      '\u001B[33m~ changed\u001B[0m',
    )
  })
})
