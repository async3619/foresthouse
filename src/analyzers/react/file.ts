import type {
  ArrowFunctionExpression,
  Function as OxcFunction,
  Program,
} from 'oxc-parser'

import type { ReactSymbolKind } from '../../types/react-symbol-kind.js'
import type { ImportBinding } from './bindings.js'
import { collectImportsAndExports } from './bindings.js'
import type { PendingReactUsageEntry } from './entries.js'
import { collectEntryUsages } from './entries.js'
import { collectTopLevelReactSymbols } from './symbols.js'
import { analyzeSymbolUsages } from './usage.js'

export interface PendingReactUsageNode {
  readonly id: string
  readonly name: string
  readonly kind: ReactSymbolKind
  readonly filePath: string
  readonly declaration: OxcFunction | ArrowFunctionExpression
  readonly exportNames: Set<string>
  readonly componentReferences: Set<string>
  readonly hookReferences: Set<string>
}

export interface FileAnalysis {
  readonly filePath: string
  readonly importsByLocalName: Map<string, ImportBinding>
  readonly exportsByName: Map<string, string>
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
  const entryUsages = collectEntryUsages(
    program,
    filePath,
    sourceText,
    includeNestedRenderEntries,
  )

  program.body.forEach((statement) => {
    collectImportsAndExports(
      statement,
      sourceDependencies,
      symbolsByName,
      importsByLocalName,
      exportsByName,
    )
  })

  symbolsByName.forEach((symbol) => {
    analyzeSymbolUsages(symbol)
  })

  return {
    filePath,
    importsByLocalName,
    exportsByName,
    entryUsages,
    symbolsById: new Map(
      [...symbolsByName.values()].map((symbol) => [symbol.id, symbol]),
    ),
    symbolsByName,
  }
}
