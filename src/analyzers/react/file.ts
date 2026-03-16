import type {
  Expression,
  FunctionBody,
  JSXElement,
  JSXFragment,
  Program,
} from 'oxc-parser'

import type { ReactSymbolKind } from '../../types/react-symbol-kind.js'
import type { ImportBinding } from './bindings.js'
import { collectImportsAndExports } from './bindings.js'
import type { PendingReactUsageEntry } from './entries.js'
import { collectEntryUsages, createReactUsageLocation } from './entries.js'
import {
  collectTopLevelDynamicComponentCandidates,
  collectTopLevelReactSymbols,
} from './symbols.js'
import { analyzeSymbolUsages } from './usage.js'

export interface PendingReactUsageNode {
  readonly id: string
  readonly name: string
  readonly kind: ReactSymbolKind
  readonly filePath: string
  readonly declarationOffset: number
  readonly analysisRoot: FunctionBody | Expression | JSXFragment | JSXElement
  readonly exportNames: Set<string>
  readonly componentReferences: Set<string>
  readonly hookReferences: Set<string>
  readonly builtinReferences: Set<string>
}

export interface FileAnalysis {
  readonly filePath: string
  readonly importsByLocalName: Map<string, ImportBinding>
  readonly exportsByName: Map<string, string>
  readonly reExportBindingsByName: Map<string, ImportBinding>
  readonly exportAllBindings: readonly ImportBinding[]
  readonly entryUsages: readonly PendingReactUsageEntry[]
  readonly allSymbolsById: Map<string, PendingReactUsageNode>
  readonly allSymbolsByName: Map<string, PendingReactUsageNode>
  readonly symbolsById: Map<string, PendingReactUsageNode>
  readonly symbolsByName: Map<string, PendingReactUsageNode>
}

export function analyzeReactFile(
  program: Program,
  filePath: string,
  sourceText: string,
  includeNestedRenderEntries: boolean,
  sourceDependencies: ReadonlyMap<string, string>,
  includeBuiltins: boolean,
): FileAnalysis {
  const symbolsByName = new Map<string, PendingReactUsageNode>()
  const dynamicComponentCandidatesByName = new Map<
    string,
    PendingReactUsageNode
  >()

  program.body.forEach((statement) => {
    collectTopLevelReactSymbols(statement, filePath, symbolsByName)
  })
  program.body.forEach((statement) => {
    collectTopLevelDynamicComponentCandidates(
      statement,
      filePath,
      symbolsByName,
      dynamicComponentCandidatesByName,
    )
  })

  const allSymbolsByName = new Map<string, PendingReactUsageNode>([
    ...dynamicComponentCandidatesByName,
    ...symbolsByName,
  ])

  const importsByLocalName = new Map<string, ImportBinding>()
  const exportsByName = new Map<string, string>()
  const reExportBindingsByName = new Map<string, ImportBinding>()
  const exportAllBindings: ImportBinding[] = []
  const directEntryUsages = includeNestedRenderEntries
    ? collectEntryUsages(program, filePath, sourceText, includeBuiltins)
    : []

  program.body.forEach((statement) => {
    collectImportsAndExports(
      statement,
      sourceDependencies,
      allSymbolsByName,
      importsByLocalName,
      exportsByName,
      reExportBindingsByName,
      exportAllBindings,
    )
  })

  allSymbolsByName.forEach((symbol) => {
    analyzeSymbolUsages(symbol, includeBuiltins)
  })

  const allSymbolsById = new Map(
    [...allSymbolsByName.values()].map((symbol) => [symbol.id, symbol]),
  )

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
    allSymbolsById,
    allSymbolsByName,
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
