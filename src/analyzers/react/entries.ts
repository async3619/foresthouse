import type { Node, Program, Statement } from 'oxc-parser'
import { visitorKeys } from 'oxc-parser'

import type { ReactSymbolKind } from '../../types/react-symbol-kind.js'
import type { ReactUsageLocation } from '../../types/react-usage-location.js'
import {
  FUNCTION_NODE_TYPES,
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

export function collectEntryUsages(
  program: Program,
  filePath: string,
  sourceText: string,
  includeNestedFunctions: boolean,
): PendingReactUsageEntry[] {
  const entries = new Map<string, PendingReactUsageEntry>()

  program.body.forEach((statement) => {
    collectStatementEntryUsages(
      statement,
      filePath,
      sourceText,
      entries,
      includeNestedFunctions,
    )
  })

  return [...entries.values()].sort(comparePendingReactUsageEntries)
}

function collectStatementEntryUsages(
  statement: Statement,
  filePath: string,
  sourceText: string,
  entries: Map<string, PendingReactUsageEntry>,
  includeNestedFunctions: boolean,
): void {
  collectNodeEntryUsages(
    statement,
    filePath,
    sourceText,
    entries,
    false,
    includeNestedFunctions,
  )
}

function collectNodeEntryUsages(
  node: Node,
  filePath: string,
  sourceText: string,
  entries: Map<string, PendingReactUsageEntry>,
  hasComponentAncestor: boolean,
  includeNestedFunctions: boolean,
): void {
  if (!includeNestedFunctions && FUNCTION_NODE_TYPES.has(node.type)) {
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
      nextHasComponentAncestor,
      includeNestedFunctions,
    )
  })
}

function collectEntryUsageChild(
  value: unknown,
  filePath: string,
  sourceText: string,
  entries: Map<string, PendingReactUsageEntry>,
  hasComponentAncestor: boolean,
  includeNestedFunctions: boolean,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      collectEntryUsageChild(
        entry,
        filePath,
        sourceText,
        entries,
        hasComponentAncestor,
        includeNestedFunctions,
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
    hasComponentAncestor,
    includeNestedFunctions,
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

function createReactUsageLocation(
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
  let line = 1
  let column = 1

  for (let index = 0; index < offset && index < sourceText.length; index += 1) {
    if (sourceText[index] === '\n') {
      line += 1
      column = 1
      continue
    }

    column += 1
  }

  return { line, column }
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
