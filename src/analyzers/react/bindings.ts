import type {
  ExportAllDeclaration,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ImportDeclaration,
  ImportDeclarationSpecifier,
  ModuleExportName,
  Statement,
} from 'oxc-parser'

import type { PendingReactUsageNode } from './file.js'

export interface ImportBinding {
  readonly importedName: string
  readonly sourceSpecifier: string
  readonly sourcePath?: string
}

export function collectImportsAndExports(
  statement: Statement,
  sourceDependencies: ReadonlyMap<string, string>,
  symbolsByName: ReadonlyMap<string, PendingReactUsageNode>,
  importsByLocalName: Map<string, ImportBinding>,
  exportsByName: Map<string, string>,
  reExportBindingsByName: Map<string, ImportBinding>,
  exportAllBindings: ImportBinding[],
): void {
  switch (statement.type) {
    case 'ImportDeclaration':
      collectImportBindings(statement, sourceDependencies, importsByLocalName)
      return
    case 'ExportNamedDeclaration':
      collectNamedExports(
        statement,
        sourceDependencies,
        symbolsByName,
        exportsByName,
        reExportBindingsByName,
      )
      return
    case 'ExportAllDeclaration':
      collectExportAllBindings(statement, sourceDependencies, exportAllBindings)
      return
    case 'ExportDefaultDeclaration':
      collectDefaultExport(
        statement,
        symbolsByName,
        importsByLocalName,
        exportsByName,
        reExportBindingsByName,
      )
      return
    default:
      return
  }
}

function collectImportBindings(
  declaration: ImportDeclaration,
  sourceDependencies: ReadonlyMap<string, string>,
  importsByLocalName: Map<string, ImportBinding>,
): void {
  if (declaration.importKind === 'type') {
    return
  }

  const sourceSpecifier = declaration.source.value
  const sourcePath = sourceDependencies.get(declaration.source.value)

  declaration.specifiers.forEach((specifier) => {
    const binding = getImportBinding(specifier, sourceSpecifier, sourcePath)
    if (binding === undefined) {
      return
    }

    importsByLocalName.set(binding.localName, {
      importedName: binding.importedName,
      sourceSpecifier: binding.sourceSpecifier,
      ...(binding.sourcePath === undefined
        ? {}
        : { sourcePath: binding.sourcePath }),
    })
  })
}

function getImportBinding(
  specifier: ImportDeclarationSpecifier,
  sourceSpecifier: string,
  sourcePath: string | undefined,
):
  | {
      readonly localName: string
      readonly importedName: string
      readonly sourceSpecifier: string
      readonly sourcePath?: string
    }
  | undefined {
  if (specifier.type === 'ImportSpecifier') {
    if (specifier.importKind === 'type') {
      return undefined
    }

    return {
      localName: specifier.local.name,
      importedName: toModuleExportName(specifier.imported),
      sourceSpecifier,
      ...(sourcePath === undefined ? {} : { sourcePath }),
    }
  }

  if (specifier.type === 'ImportDefaultSpecifier') {
    return {
      localName: specifier.local.name,
      importedName: 'default',
      sourceSpecifier,
      ...(sourcePath === undefined ? {} : { sourcePath }),
    }
  }

  return undefined
}

function collectNamedExports(
  declaration: ExportNamedDeclaration,
  sourceDependencies: ReadonlyMap<string, string>,
  symbolsByName: ReadonlyMap<string, PendingReactUsageNode>,
  exportsByName: Map<string, string>,
  reExportBindingsByName: Map<string, ImportBinding>,
): void {
  if (declaration.exportKind === 'type') {
    return
  }

  if (declaration.declaration !== null) {
    if (declaration.declaration.type === 'FunctionDeclaration') {
      const name = declaration.declaration.id?.name
      if (name !== undefined) {
        addExportBinding(name, name, symbolsByName, exportsByName)
      }
    } else if (declaration.declaration.type === 'VariableDeclaration') {
      declaration.declaration.declarations.forEach((declarator) => {
        if (declarator.id.type === 'Identifier') {
          addExportBinding(
            declarator.id.name,
            declarator.id.name,
            symbolsByName,
            exportsByName,
          )
        }
      })
    }

    return
  }

  if (declaration.source !== null) {
    const sourceSpecifier = declaration.source.value
    const sourcePath = sourceDependencies.get(sourceSpecifier)

    declaration.specifiers.forEach((specifier) => {
      if (specifier.exportKind === 'type') {
        return
      }

      reExportBindingsByName.set(toModuleExportName(specifier.exported), {
        importedName: toModuleExportName(specifier.local),
        sourceSpecifier,
        ...(sourcePath === undefined ? {} : { sourcePath }),
      })
    })
    return
  }

  declaration.specifiers.forEach((specifier) => {
    if (specifier.exportKind === 'type') {
      return
    }

    const localName = toModuleExportName(specifier.local)
    const exportedName = toModuleExportName(specifier.exported)
    addExportBinding(localName, exportedName, symbolsByName, exportsByName)
  })
}

function collectExportAllBindings(
  declaration: ExportAllDeclaration,
  sourceDependencies: ReadonlyMap<string, string>,
  exportAllBindings: ImportBinding[],
): void {
  if (declaration.exportKind === 'type') {
    return
  }

  const sourceSpecifier = declaration.source.value
  const sourcePath = sourceDependencies.get(sourceSpecifier)

  exportAllBindings.push({
    importedName: '*',
    sourceSpecifier,
    ...(sourcePath === undefined ? {} : { sourcePath }),
  })
}

function collectDefaultExport(
  declaration: ExportDefaultDeclaration,
  symbolsByName: ReadonlyMap<string, PendingReactUsageNode>,
  importsByLocalName: ReadonlyMap<string, ImportBinding>,
  exportsByName: Map<string, string>,
  reExportBindingsByName: Map<string, ImportBinding>,
): void {
  if (
    declaration.declaration.type === 'FunctionDeclaration' ||
    declaration.declaration.type === 'FunctionExpression'
  ) {
    const localName = declaration.declaration.id?.name
    if (localName !== undefined) {
      addExportBinding(localName, 'default', symbolsByName, exportsByName)
    }
    return
  }

  if (declaration.declaration.type === 'Identifier') {
    const localName = declaration.declaration.name
    addExportBinding(localName, 'default', symbolsByName, exportsByName)

    if (!exportsByName.has('default')) {
      const importBinding = importsByLocalName.get(localName)
      if (importBinding !== undefined) {
        reExportBindingsByName.set('default', importBinding)
      }
    }
    return
  }

  if (declaration.declaration.type === 'ArrowFunctionExpression') {
    addExportBinding('default', 'default', symbolsByName, exportsByName)
  }
}

function addExportBinding(
  localName: string,
  exportedName: string,
  symbolsByName: ReadonlyMap<string, PendingReactUsageNode>,
  exportsByName: Map<string, string>,
): void {
  const symbol = symbolsByName.get(localName)
  if (symbol === undefined) {
    return
  }

  symbol.exportNames.add(exportedName)
  exportsByName.set(exportedName, symbol.id)
}

function toModuleExportName(name: ModuleExportName): string {
  return name.type === 'Literal' ? name.value : name.name
}
