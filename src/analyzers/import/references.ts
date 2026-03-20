import ts from 'typescript'

import type { ReferenceKind } from '../../types/reference-kind.js'
import { collectUnusedImports } from './unused.js'

export interface ModuleReference {
  readonly specifier: string
  readonly referenceKind: ReferenceKind
  readonly isTypeOnly: boolean
  readonly unused: boolean
}

export function collectModuleReferences(
  sourceFile: ts.SourceFile,
  checker?: ts.TypeChecker,
): ModuleReference[] {
  const references = new Map<string, ModuleReference>()
  const unusedImports =
    checker === undefined
      ? new Map<ts.ImportDeclaration, boolean>()
      : collectUnusedImports(sourceFile, checker)

  function addReference(
    specifier: string,
    referenceKind: ReferenceKind,
    isTypeOnly: boolean,
    unused: boolean,
  ): void {
    const key = `${referenceKind}:${isTypeOnly ? 'type' : 'value'}:${specifier}`
    const existing = references.get(key)
    if (existing !== undefined) {
      if (existing.unused && !unused) {
        references.set(key, {
          ...existing,
          unused: false,
        })
      }
      return
    }

    references.set(key, {
      specifier,
      referenceKind,
      isTypeOnly,
      unused,
    })
  }

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      addReference(
        node.moduleSpecifier.text,
        'import',
        node.importClause?.isTypeOnly ?? false,
        unusedImports.get(node) ?? false,
      )
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      addReference(
        node.moduleSpecifier.text,
        'export',
        node.isTypeOnly ?? false,
        false,
      )
    } else if (ts.isImportEqualsDeclaration(node)) {
      const moduleReference = node.moduleReference
      if (
        ts.isExternalModuleReference(moduleReference) &&
        moduleReference.expression !== undefined &&
        ts.isStringLiteralLike(moduleReference.expression)
      ) {
        addReference(
          moduleReference.expression.text,
          'import-equals',
          false,
          false,
        )
      }
    } else if (ts.isCallExpression(node)) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1
      ) {
        const [argument] = node.arguments
        if (argument !== undefined && ts.isStringLiteralLike(argument)) {
          addReference(argument.text, 'dynamic-import', false, false)
        }
      }

      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length === 1
      ) {
        const [argument] = node.arguments
        if (argument !== undefined && ts.isStringLiteralLike(argument)) {
          addReference(argument.text, 'require', false, false)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return [...references.values()]
}
