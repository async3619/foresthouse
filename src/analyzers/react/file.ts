import type {
  ArrowFunctionExpression,
  Function as OxcFunction,
  Program,
} from 'oxc-parser'

import type { ReactSymbolKind } from '../../types/react-symbol-kind.js'
import type { ImportBinding } from './bindings.js'
import { collectImportsAndExports } from './bindings.js'
import type { PendingReactUsageEntry } from './entries.js'
import { collectEntryUsages, createReactUsageLocation } from './entries.js'
import { collectTopLevelReactSymbols } from './symbols.js'
import { analyzeSymbolUsages } from './usage.js'

export interface PendingReactUsageNode {
  readonly id: string
  readonly name: string
  readonly kind: ReactSymbolKind
  readonly filePath: string
  readonly declarationOffset: number
  readonly declaration: OxcFunction | ArrowFunctionExpression
  readonly exportNames: Set<string>
  readonly componentReferences: Set<string>
  readonly hookReferences: Set<string>
}

export interface FileAnalysis {
  readonly filePath: string
  readonly importsByLocalName: Map<string, ImportBinding>
  readonly exportsByName: Map<string, string>
  readonly reExportBindingsByName: Map<string, ImportBinding>
  readonly exportAllBindings: readonly ImportBinding[]
  readonly entryUsages: readonly PendingReactUsageEntry[]
  readonly symbolsById: Map<string, PendingReactUsageNode>
  readonly symbolsByName: Map<string, PendingReactUsageNode>
}

export function analyzeReactFile(
  program: Program,
  filePath: string,
  sourceText: string,
  includeNestedRenderEntries: boolean,
  sourceDependencies: ReadonlyMap<string, string>,
): FileAnalysis {
  const symbolsByName = new Map<string, PendingReactUsageNode>()

  program.body.forEach((statement) => {
    collectTopLevelReactSymbols(statement, filePath, symbolsByName)
  })

  const importsByLocalName = new Map<string, ImportBinding>()
  const exportsByName = new Map<string, string>()
  const reExportBindingsByName = new Map<string, ImportBinding>()
  const exportAllBindings: ImportBinding[] = []
  const directEntryUsages = includeNestedRenderEntries
    ? collectEntryUsages(program, filePath, sourceText)
    : []

  program.body.forEach((statement) => {
    collectImportsAndExports(
      statement,
      sourceDependencies,
      symbolsByName,
      importsByLocalName,
      exportsByName,
      reExportBindingsByName,
      exportAllBindings,
    )
  })

  symbolsByName.forEach((symbol) => {
    analyzeSymbolUsages(symbol)
  })

  const entryUsages =
    directEntryUsages.length > 0
      ? directEntryUsages
      : includeNestedRenderEntries
        ? collectComponentDeclarationEntryUsages(symbolsByName, sourceText)
        : []

  return {
    filePath,
    importsByLocalName,
    exportsByName,
    reExportBindingsByName,
    exportAllBindings,
    entryUsages,
    symbolsById: new Map(
      [...symbolsByName.values()].map((symbol) => [symbol.id, symbol]),
    ),
    symbolsByName,
  }
}

function collectComponentDeclarationEntryUsages(
  symbolsByName: ReadonlyMap<string, PendingReactUsageNode>,
  sourceText: string,
): PendingReactUsageEntry[] {
  const componentSymbols = [...symbolsByName.values()].filter(
    (symbol) => symbol.kind === 'component',
  )
  if (componentSymbols.length === 0) {
    return []
  }

  const exportedComponentSymbols = componentSymbols.filter(
    (symbol) => symbol.exportNames.size > 0,
  )
  const fallbackSymbols =
    exportedComponentSymbols.length > 0
      ? exportedComponentSymbols
      : componentSymbols

  return fallbackSymbols
    .sort((left, right) => {
      return (
        left.declarationOffset - right.declarationOffset ||
        left.name.localeCompare(right.name)
      )
    })
    .map((symbol) => ({
      referenceName: symbol.name,
      kind: 'component',
      location: createReactUsageLocation(
        symbol.filePath,
        sourceText,
        symbol.declarationOffset,
      ),
    }))
}
