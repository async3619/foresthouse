import process from 'node:process'

import type { ColorMode } from './types/color-mode.js'
import type { ReactSymbolKind } from './types/react-symbol-kind.js'

const ANSI_RESET = '\u001B[0m'
const ANSI_COMPONENT = '\u001B[36m'
const ANSI_HOOK = '\u001B[35m'
const ANSI_BUILTIN = '\u001B[34m'
const ANSI_MUTED = '\u001B[38;5;244m'
const ANSI_UNUSED = '\u001B[38;5;214m'
const ANSI_DIFF_ADDED = '\u001B[32m'
const ANSI_DIFF_REMOVED = '\u001B[31m'
const ANSI_DIFF_CHANGED = '\u001B[33m'

interface ResolveColorSupportOptions {
  readonly forceColor?: string | undefined
  readonly isTTY?: boolean | undefined
  readonly noColor?: string | undefined
}

export function resolveColorSupport(
  mode: ColorMode = 'auto',
  options: ResolveColorSupportOptions = {},
): boolean {
  if (mode === true) {
    return true
  }

  if (mode === false) {
    return false
  }

  const forceColor =
    'forceColor' in options ? options.forceColor : process.env.FORCE_COLOR
  if (forceColor !== undefined) {
    return forceColor !== '0'
  }

  const noColor = 'noColor' in options ? options.noColor : process.env.NO_COLOR
  if (noColor !== undefined) {
    return false
  }

  const isTTY = 'isTTY' in options ? options.isTTY : process.stdout.isTTY
  return isTTY === true
}

export function colorizeUnusedMarker(text: string, enabled: boolean): string {
  if (!enabled) {
    return text
  }

  return text.replaceAll('(unused)', `${ANSI_UNUSED}(unused)${ANSI_RESET}`)
}

export function formatReactSymbolLabel(
  name: string,
  kind: ReactSymbolKind,
  enabled: boolean,
): string {
  const label = `${formatReactSymbolName(name, kind)} [${kind}]`
  if (!enabled) {
    return label
  }

  return `${getReactSymbolColor(kind)}${label}${ANSI_RESET}`
}

export function formatReactSymbolName(
  name: string,
  kind: ReactSymbolKind,
): string {
  if (kind === 'component') {
    return `<${name} />`
  }

  if (kind === 'hook') {
    return `${name}()`
  }

  return `<${name}>`
}
export function colorizeReactLabel(
  text: string,
  kind: ReactSymbolKind,
  enabled: boolean,
): string {
  if (!enabled) {
    return text
  }

  return `${getReactSymbolColor(kind)}${text}${ANSI_RESET}`
}

export function colorizeMuted(text: string, enabled: boolean): string {
  if (!enabled) {
    return text
  }

  return `${ANSI_MUTED}${text}${ANSI_RESET}`
}

export function colorizePackageDiff(
  text: string,
  change: 'added' | 'removed' | 'changed',
  enabled: boolean,
): string {
  if (!enabled) {
    return text
  }

  return `${getPackageDiffColor(change)}${text}${ANSI_RESET}`
}

function getReactSymbolColor(kind: ReactSymbolKind): string {
  if (kind === 'component') {
    return ANSI_COMPONENT
  }

  if (kind === 'hook') {
    return ANSI_HOOK
  }

  return ANSI_BUILTIN
}

function getPackageDiffColor(change: 'added' | 'removed' | 'changed'): string {
  if (change === 'added') {
    return ANSI_DIFF_ADDED
  }

  if (change === 'removed') {
    return ANSI_DIFF_REMOVED
  }

  return ANSI_DIFF_CHANGED
}
