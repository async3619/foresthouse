import { describe, expect, it } from 'vitest'

import {
  colorizeUnusedMarker,
  formatReactSymbolLabel,
  resolveColorSupport,
} from '../src/color.js'

describe('color helpers', () => {
  it('can colorize the unused marker in isolation', () => {
    expect(colorizeUnusedMarker('src/file.ts (unused)', true)).toBe(
      'src/file.ts \u001B[38;5;214m(unused)\u001B[0m',
    )
    expect(colorizeUnusedMarker('src/file.ts (unused)', false)).toBe(
      'src/file.ts (unused)',
    )
  })

  it('uses different colors for components, hooks, and builtins', () => {
    expect(formatReactSymbolLabel('Panel', 'component', true)).toBe(
      '\u001B[36m<Panel /> [component]\u001B[0m',
    )
    expect(formatReactSymbolLabel('usePanelState', 'hook', true)).toBe(
      '\u001B[35musePanelState() [hook]\u001B[0m',
    )
    expect(formatReactSymbolLabel('button', 'builtin', true)).toBe(
      '\u001B[34m<button> [builtin]\u001B[0m',
    )
  })

  it('resolves automatic color support from terminal settings', () => {
    expect(
      resolveColorSupport('auto', {
        forceColor: undefined,
        isTTY: true,
        noColor: undefined,
      }),
    ).toBe(true)
    expect(
      resolveColorSupport('auto', {
        isTTY: true,
        noColor: '1',
      }),
    ).toBe(false)
    expect(
      resolveColorSupport('auto', {
        forceColor: '1',
        isTTY: false,
      }),
    ).toBe(true)
  })
})
