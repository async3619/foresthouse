import type {
  ArrowFunctionExpression,
  ExportDefaultDeclaration,
  Expression,
  FunctionBody,
  JSXElement,
  JSXFragment,
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

export function collectTopLevelDynamicComponentCandidates(
  statement: Statement,
  filePath: string,
  symbolsByName: ReadonlyMap<string, PendingReactUsageNode>,
  dynamicComponentCandidatesByName: Map<string, PendingReactUsageNode>,
): void {
  switch (statement.type) {
    case 'VariableDeclaration':
      statement.declarations.forEach((declarator) => {
        addDynamicComponentCandidate(
          declarator,
          filePath,
          symbolsByName,
          dynamicComponentCandidatesByName,
        )
      })
      return
    case 'ExportNamedDeclaration':
      if (statement.declaration !== null) {
        collectTopLevelDynamicComponentCandidates(
          statement.declaration,
          filePath,
          symbolsByName,
          dynamicComponentCandidatesByName,
        )
      }
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
    createPendingSymbol(
      filePath,
      name,
      kind,
      declaration.id?.start ?? declaration.start,
      getAnalysisRoot(declaration),
    ),
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

  const name = declarator.id.name
  const kind = classifyReactSymbol(name, declarator.init)
  if (kind === undefined) {
    return
  }

  symbolsByName.set(
    name,
    createPendingSymbol(
      filePath,
      name,
      kind,
      declarator.init.start,
      getAnalysisRoot(declarator.init),
    ),
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
        createPendingSymbol(
          filePath,
          name,
          kind,
          declaration.declaration.start,
          getAnalysisRoot(declaration.declaration),
        ),
      )
    }
  }
}

function addDynamicComponentCandidate(
  declarator: VariableDeclarator,
  filePath: string,
  symbolsByName: ReadonlyMap<string, PendingReactUsageNode>,
  dynamicComponentCandidatesByName: Map<string, PendingReactUsageNode>,
): void {
  if (declarator.id.type !== 'Identifier' || declarator.init === null) {
    return
  }

  const name = declarator.id.name
  if (
    !isPotentialDynamicComponentName(name) ||
    symbolsByName.has(name) ||
    !isDynamicComponentInitializer(declarator.init)
  ) {
    return
  }

  dynamicComponentCandidatesByName.set(
    name,
    createPendingSymbol(
      filePath,
      name,
      'component',
      declarator.init.start,
      getAnalysisRoot(declarator.init),
    ),
  )
}

function createPendingSymbol(
  filePath: string,
  name: string,
  kind: ReactSymbolKind,
  declarationOffset: number,
  analysisRoot: FunctionBody | Expression | JSXFragment | JSXElement,
): PendingReactUsageNode {
  return {
    id: `${filePath}#${kind}:${name}`,
    name,
    kind,
    filePath,
    declarationOffset,
    analysisRoot,
    exportNames: new Set<string>(),
    componentReferences: new Set<string>(),
    hookReferences: new Set<string>(),
    builtinReferences: new Set<string>(),
  }
}

function getAnalysisRoot(
  declaration: OxcFunction | ArrowFunctionExpression | Expression,
): FunctionBody | Expression | JSXFragment | JSXElement {
  if (
    declaration.type === 'FunctionDeclaration' ||
    declaration.type === 'FunctionExpression'
  ) {
    if (declaration.body === null) {
      throw new Error(
        `Expected React symbol "${declaration.id?.name ?? 'anonymous'}" to have a body.`,
      )
    }

    return declaration.body
  }

  if (declaration.type === 'ArrowFunctionExpression') {
    return declaration.body
  }

  return declaration
}

function isDynamicComponentInitializer(expression: Expression): boolean {
  return (
    expression.type === 'CallExpression' ||
    expression.type === 'TaggedTemplateExpression'
  )
}

function isPotentialDynamicComponentName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name)
}
