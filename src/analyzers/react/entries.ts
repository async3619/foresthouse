import type { Node, Program, Statement } from 'oxc-parser'
import { visitorKeys } from 'oxc-parser'

import type { ReactSymbolKind } from '../../types/react-symbol-kind.js'
import type { ReactUsageLocation } from '../../types/react-usage-location.js'
import {
  FUNCTION_NODE_TYPES,
  getBuiltinReferenceName,
  getComponentReferenceName,
  getCreateElementComponentReferenceName,
  getHookReferenceName,
  isNode,
} from './walk.js'

export interface PendingReactUsageEntry {
  readonly referenceName: string
  readonly kind: ReactSymbolKind
  readonly location: ReactUsageLocation
}

const lineStartOffsetsCache = new Map<string, readonly number[]>()

export function collectEntryUsages(
  program: Program,
  filePath: string,
  sourceText: string,
  includeBuiltins: boolean,
): PendingReactUsageEntry[] {
  const entries = new Map<string, PendingReactUsageEntry>()

  program.body.forEach((statement) => {
    collectStatementEntryUsages(
      statement,
      filePath,
      sourceText,
      entries,
      includeBuiltins,
    )
  })

  return [...entries.values()].sort(comparePendingReactUsageEntries)
}

function collectStatementEntryUsages(
  statement: Statement,
  filePath: string,
  sourceText: string,
  entries: Map<string, PendingReactUsageEntry>,
  includeBuiltins: boolean,
): void {
  collectNodeEntryUsages(
    statement,
    filePath,
    sourceText,
    entries,
    includeBuiltins,
    false,
  )
}

function collectNodeEntryUsages(
  node: Node,
  filePath: string,
  sourceText: string,
  entries: Map<string, PendingReactUsageEntry>,
  includeBuiltins: boolean,
  hasComponentAncestor: boolean,
): void {
  if (FUNCTION_NODE_TYPES.has(node.type)) {
    return
  }

  let nextHasComponentAncestor = hasComponentAncestor

  if (node.type === 'JSXElement') {
    const referenceName = getComponentReferenceName(node)
    if (referenceName !== undefined) {
      if (!hasComponentAncestor) {
        addPendingReactUsageEntry(
          entries,
          referenceName,
          'component',
          createReactUsageLocation(filePath, sourceText, node.start),
        )
      }
      nextHasComponentAncestor = true
    } else if (includeBuiltins) {
      const builtinName = getBuiltinReferenceName(node)
      if (builtinName !== undefined) {
        if (!hasComponentAncestor) {
          addPendingReactUsageEntry(
            entries,
            builtinName,
            'builtin',
            createReactUsageLocation(filePath, sourceText, node.start),
          )
        }
        nextHasComponentAncestor = true
      }
    }
  } else if (node.type === 'CallExpression') {
    const hookReference = getHookReferenceName(node)
    if (hookReference !== undefined) {
      addPendingReactUsageEntry(
        entries,
        hookReference,
        'hook',
        createReactUsageLocation(filePath, sourceText, node.start),
      )
    }

    const referenceName = getCreateElementComponentReferenceName(node)
    if (referenceName !== undefined) {
      if (!hasComponentAncestor) {
        addPendingReactUsageEntry(
          entries,
          referenceName,
          'component',
          createReactUsageLocation(filePath, sourceText, node.start),
        )
      }
      nextHasComponentAncestor = true
    }
  }

  const keys = visitorKeys[node.type]
  if (keys === undefined) {
    return
  }

  keys.forEach((key) => {
    const value = (node as unknown as Record<string, unknown>)[key]
    collectEntryUsageChild(
      value,
      filePath,
      sourceText,
      entries,
      includeBuiltins,
      nextHasComponentAncestor,
    )
  })
}

function collectEntryUsageChild(
  value: unknown,
  filePath: string,
  sourceText: string,
  entries: Map<string, PendingReactUsageEntry>,
  includeBuiltins: boolean,
  hasComponentAncestor: boolean,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      collectEntryUsageChild(
        entry,
        filePath,
        sourceText,
        entries,
        includeBuiltins,
        hasComponentAncestor,
      )
    })
    return
  }

  if (!isNode(value)) {
    return
  }

  collectNodeEntryUsages(
    value,
    filePath,
    sourceText,
    entries,
    includeBuiltins,
    hasComponentAncestor,
  )
}

function addPendingReactUsageEntry(
  entries: Map<string, PendingReactUsageEntry>,
  referenceName: string,
  kind: ReactSymbolKind,
  location: ReactUsageLocation,
): void {
  const key = `${location.filePath}:${location.line}:${location.column}:${kind}:${referenceName}`
  entries.set(key, {
    referenceName,
    kind,
    location,
  })
}

export function createReactUsageLocation(
  filePath: string,
  sourceText: string,
  offset: number,
): ReactUsageLocation {
  return {
    filePath,
    ...offsetToLineAndColumn(sourceText, offset),
  }
}

function offsetToLineAndColumn(
  sourceText: string,
  offset: number,
): Pick<ReactUsageLocation, 'line' | 'column'> {
  const lineStartOffsets = getLineStartOffsets(sourceText)
  const boundedOffset = Math.max(0, Math.min(offset, sourceText.length))
  const lineIndex = findLineIndex(lineStartOffsets, boundedOffset)
  const lineStartOffset = lineStartOffsets[lineIndex] ?? 0

  return {
    line: lineIndex + 1,
    column: boundedOffset - lineStartOffset + 1,
  }
}

function comparePendingReactUsageEntries(
  left: PendingReactUsageEntry,
  right: PendingReactUsageEntry,
): number {
  return (
    left.location.filePath.localeCompare(right.location.filePath) ||
    left.location.line - right.location.line ||
    left.location.column - right.location.column ||
    left.kind.localeCompare(right.kind) ||
    left.referenceName.localeCompare(right.referenceName)
  )
}

function getLineStartOffsets(sourceText: string): readonly number[] {
  const cached = lineStartOffsetsCache.get(sourceText)
  if (cached !== undefined) {
    return cached
  }

  const lineStartOffsets = [0]
  for (let index = 0; index < sourceText.length; index += 1) {
    if (sourceText[index] === '\n') {
      lineStartOffsets.push(index + 1)
    }
  }

  lineStartOffsetsCache.set(sourceText, lineStartOffsets)
  return lineStartOffsets
}

function findLineIndex(
  lineStartOffsets: readonly number[],
  offset: number,
): number {
  let lowerBound = 0
  let upperBound = lineStartOffsets.length - 1

  while (lowerBound <= upperBound) {
    const middleIndex = Math.floor((lowerBound + upperBound) / 2)
    const middleOffset = lineStartOffsets[middleIndex]
    const nextOffset = lineStartOffsets[middleIndex + 1]

    if (middleOffset === undefined) {
      return 0
    }

    if (offset < middleOffset) {
      upperBound = middleIndex - 1
      continue
    }

    if (nextOffset === undefined || offset < nextOffset) {
      return middleIndex
    }

    lowerBound = middleIndex + 1
  }

  return Math.max(0, lineStartOffsets.length - 1)
}
