import ts from 'typescript'

export function collectUnusedImports(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ReadonlyMap<ts.ImportDeclaration, boolean> {
  const importUsage = new Map<
    ts.ImportDeclaration,
    {
      canTrack: boolean
      used: boolean
    }
  >()
  const symbolToImportDeclaration = new Map<ts.Symbol, ts.ImportDeclaration>()
  const importedLocalNames = new Set<string>()

  sourceFile.statements.forEach((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      statement.importClause === undefined
    ) {
      return
    }

    const identifiers = getImportBindingIdentifiers(statement.importClause)
    if (identifiers.length === 0) {
      return
    }

    importUsage.set(statement, {
      canTrack: false,
      used: false,
    })

    identifiers.forEach((identifier) => {
      importedLocalNames.add(identifier.text)

      const symbol = tryGetSymbolAtLocation(checker, identifier)
      if (symbol === undefined) {
        return
      }

      symbolToImportDeclaration.set(symbol, statement)
      const state = importUsage.get(statement)
      if (state !== undefined) {
        state.canTrack = true
      }
    })
  })

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      return
    }

    if (
      ts.isIdentifier(node) &&
      importedLocalNames.has(node.text) &&
      isReferenceIdentifier(node)
    ) {
      const symbol = tryGetSymbolAtLocation(checker, node)
      const declaration =
        symbol === undefined ? undefined : symbolToImportDeclaration.get(symbol)
      if (declaration !== undefined) {
        const state = importUsage.get(declaration)
        if (state !== undefined) {
          state.used = true
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return new Map(
    [...importUsage.entries()].map(([declaration, state]) => [
      declaration,
      state.canTrack && !state.used,
    ]),
  )
}

function getImportBindingIdentifiers(
  importClause: ts.ImportClause,
): ts.Identifier[] {
  const identifiers: ts.Identifier[] = []

  if (importClause.name !== undefined) {
    identifiers.push(importClause.name)
  }

  const namedBindings = importClause.namedBindings
  if (namedBindings === undefined) {
    return identifiers
  }

  if (ts.isNamespaceImport(namedBindings)) {
    identifiers.push(namedBindings.name)
    return identifiers
  }

  namedBindings.elements.forEach((element) => {
    identifiers.push(element.name)
  })

  return identifiers
}

function isReferenceIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent

  if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
    return false
  }

  if (ts.isQualifiedName(parent) && parent.right === node) {
    return false
  }

  if (ts.isPropertyAssignment(parent) && parent.name === node) {
    return false
  }

  if (ts.isBindingElement(parent) && parent.propertyName === node) {
    return false
  }

  if (ts.isJsxAttribute(parent) && parent.name === node) {
    return false
  }

  if (ts.isExportSpecifier(parent)) {
    return parent.propertyName === node || parent.propertyName === undefined
  }

  return true
}

function tryGetSymbolAtLocation(
  checker: ts.TypeChecker,
  node: ts.Node,
): ts.Symbol | undefined {
  try {
    return checker.getSymbolAtLocation(node)
  } catch {
    return undefined
  }
}
