import process from 'node:process'

import type { ColorMode, ReactSymbolKind } from './types.js'

const ANSI_RESET = '\u001B[0m'
const ANSI_COMPONENT = '\u001B[36m'
const ANSI_HOOK = '\u001B[35m'
const ANSI_UNUSED = '\u001B[38;5;214m'

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
  const label = `${name} [${kind}]`
  if (!enabled) {
    return label
  }

  const color = kind === 'component' ? ANSI_COMPONENT : ANSI_HOOK
  return `${color}${label}${ANSI_RESET}`
}
