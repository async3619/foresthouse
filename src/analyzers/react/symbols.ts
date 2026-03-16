import type {
  ArrowFunctionExpression,
  ExportDefaultDeclaration,
  Function as OxcFunction,
  Statement,
  VariableDeclarator,
} from 'oxc-parser'

import type { ReactSymbolKind } from '../../types/react-symbol-kind.js'
import type { PendingReactUsageNode } from './file.js'
import { classifyReactSymbol } from './walk.js'

export function collectTopLevelReactSymbols(
  statement: Statement,
  filePath: string,
  symbolsByName: Map<string, PendingReactUsageNode>,
): void {
  switch (statement.type) {
    case 'FunctionDeclaration':
      addFunctionSymbol(statement, filePath, symbolsByName)
      return
    case 'VariableDeclaration':
      statement.declarations.forEach((declarator) => {
        addVariableSymbol(declarator, filePath, symbolsByName)
      })
      return
    case 'ExportNamedDeclaration':
      if (statement.declaration !== null) {
        collectTopLevelReactSymbols(
          statement.declaration,
          filePath,
          symbolsByName,
        )
      }
      return
    case 'ExportDefaultDeclaration':
      addDefaultExportSymbol(statement, filePath, symbolsByName)
      return
    default:
      return
  }
}

function addFunctionSymbol(
  declaration: OxcFunction,
  filePath: string,
  symbolsByName: Map<string, PendingReactUsageNode>,
): void {
  const name = declaration.id?.name
  if (name === undefined) {
    return
  }

  const kind = classifyReactSymbol(name, declaration)
  if (kind === undefined) {
    return
  }

  symbolsByName.set(
    name,
    createPendingSymbol(filePath, name, kind, declaration),
  )
}

function addVariableSymbol(
  declarator: VariableDeclarator,
  filePath: string,
  symbolsByName: Map<string, PendingReactUsageNode>,
): void {
  if (declarator.id.type !== 'Identifier' || declarator.init === null) {
    return
  }

  if (
    declarator.init.type !== 'ArrowFunctionExpression' &&
    declarator.init.type !== 'FunctionExpression'
  ) {
    return
  }

  const name = declarator.id.name
  const kind = classifyReactSymbol(name, declarator.init)
  if (kind === undefined) {
    return
  }

  symbolsByName.set(
    name,
    createPendingSymbol(filePath, name, kind, declarator.init),
  )
}

function addDefaultExportSymbol(
  declaration: ExportDefaultDeclaration,
  filePath: string,
  symbolsByName: Map<string, PendingReactUsageNode>,
): void {
  if (
    declaration.declaration.type === 'FunctionDeclaration' ||
    declaration.declaration.type === 'FunctionExpression'
  ) {
    addFunctionSymbol(declaration.declaration, filePath, symbolsByName)
  } else if (declaration.declaration.type === 'ArrowFunctionExpression') {
    const name = 'default'
    const kind = declaration.declaration.body
      ? classifyReactSymbol(name, declaration.declaration)
      : undefined
    if (kind !== undefined) {
      symbolsByName.set(
        name,
        createPendingSymbol(filePath, name, kind, declaration.declaration),
      )
    }
  }
}

function createPendingSymbol(
  filePath: string,
  name: string,
  kind: ReactSymbolKind,
  declaration: OxcFunction | ArrowFunctionExpression,
): PendingReactUsageNode {
  return {
    id: `${filePath}#${kind}:${name}`,
    name,
    kind,
    filePath,
    declaration,
    exportNames: new Set<string>(),
    componentReferences: new Set<string>(),
    hookReferences: new Set<string>(),
  }
}
