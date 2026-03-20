import { parseSync } from 'oxc-parser'

import type { ReferenceKind } from '../../types/reference-kind.js'

export interface ModuleReference {
  readonly specifier: string
  readonly referenceKind: ReferenceKind
  readonly isTypeOnly: boolean
  readonly unused: boolean
}

export function collectModuleReferences(
  filePath: string,
  sourceText: string,
  trackUnusedImports: boolean,
): ModuleReference[] {
  const parseResult = parseSync(filePath, sourceText)
  const mod = parseResult.module
  const references = new Map<string, ModuleReference>()

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

  // Static imports
  for (const imp of mod.staticImports) {
    const specifier = imp.moduleRequest.value
    const isTypeOnly =
      imp.entries.length > 0 && imp.entries.every((e) => e.isType)

    let unused = false
    if (trackUnusedImports && imp.entries.length > 0) {
      const localNames = imp.entries.map((e) => e.localName.value)
      unused = !isAnyNameUsedAfter(imp.end, localNames, sourceText)
    }

    addReference(specifier, 'import', isTypeOnly, unused)
  }

  // Static exports (re-exports only)
  for (const exp of mod.staticExports) {
    const reExportEntry = exp.entries.find((e) => e.moduleRequest !== null)
    if (reExportEntry?.moduleRequest != null) {
      const specifier = reExportEntry.moduleRequest.value
      const isTypeOnly = exp.entries.every((e) => e.isType)
      addReference(specifier, 'export', isTypeOnly, false)
    }
  }

  // Dynamic imports
  for (const di of mod.dynamicImports) {
    const req = di.moduleRequest
    if (req.start != null && req.end != null) {
      const specifier = extractStringLiteral(sourceText, req.start, req.end)
      if (specifier !== undefined) {
        addReference(specifier, 'dynamic-import', false, false)
      }
    }
  }

  // require() and import-equals: only scan if source contains 'require('
  if (sourceText.includes('require(')) {
    collectRequireReferences(parseResult.program.body, addReference)
  }

  return [...references.values()]
}

function isAnyNameUsedAfter(
  afterPosition: number,
  names: string[],
  sourceText: string,
): boolean {
  const restOfFile = sourceText.slice(afterPosition)
  return names.some((name) => {
    const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`)
    return regex.test(restOfFile)
  })
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractStringLiteral(
  sourceText: string,
  start: number,
  end: number,
): string | undefined {
  const raw = sourceText.slice(start, end)
  if (
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith('`') && raw.endsWith('`') && !raw.includes('${'))
  ) {
    return raw.slice(1, -1)
  }

  return undefined
}

function collectRequireReferences(
  body: unknown[],
  addReference: (
    specifier: string,
    kind: ReferenceKind,
    isTypeOnly: boolean,
    unused: boolean,
  ) => void,
): void {
  function visit(node: unknown): void {
    if (node === null || node === undefined || typeof node !== 'object') {
      return
    }

    const n = node as Record<string, unknown>

    // TSImportEqualsDeclaration: import foo = require('bar')
    if (n.type === 'TSImportEqualsDeclaration') {
      const moduleRef = n.moduleReference as Record<string, unknown> | undefined
      if (moduleRef?.type === 'TSExternalModuleReference') {
        const expr = moduleRef.expression as Record<string, unknown> | undefined
        if (expr?.type === 'Literal' && typeof expr.value === 'string') {
          addReference(expr.value, 'import-equals', false, false)
          return
        }
      }
    }

    // require('...') calls
    if (n.type === 'CallExpression') {
      const callee = n.callee as Record<string, unknown> | undefined
      const args = n.arguments as unknown[] | undefined
      if (
        callee?.type === 'Identifier' &&
        callee.name === 'require' &&
        Array.isArray(args) &&
        args.length === 1
      ) {
        const arg = args[0] as Record<string, unknown> | undefined
        if (arg?.type === 'Literal' && typeof arg.value === 'string') {
          addReference(arg.value, 'require', false, false)
          return
        }
      }
    }

    // Recurse into child nodes
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object' && 'type' in item) {
            visit(item)
          }
        }
      } else if (value && typeof value === 'object' && 'type' in value) {
        visit(value)
      }
    }
  }

  for (const stmt of body) {
    visit(stmt)
  }
}
