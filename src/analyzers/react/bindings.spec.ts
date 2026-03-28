import { parseSync } from 'oxc-parser'
import { describe, expect, it } from 'vitest'
import type { ImportBinding } from './bindings.js'
import { collectImportsAndExports } from './bindings.js'
import type { PendingReactUsageNode } from './file.js'

function createMockSymbol(
  name: string,
  kind: 'component' | 'hook',
): PendingReactUsageNode {
  return {
    id: `test.tsx#${kind}:${name}`,
    name,
    kind,
    filePath: 'test.tsx',
    declarationOffset: 0,
    analysisRoot: { type: 'FunctionBody' } as never,
    exportNames: new Set(),
    componentReferences: new Set(),
    hookReferences: new Set(),
    builtinReferences: new Set(),
  }
}

function collect(
  code: string,
  opts?: {
    sourceDeps?: Map<string, string>
    symbols?: Map<string, PendingReactUsageNode>
  },
) {
  const { program } = parseSync('test.tsx', code)
  const sourceDependencies = opts?.sourceDeps ?? new Map()
  const symbolsByName = opts?.symbols ?? new Map()
  const importsByLocalName = new Map<string, ImportBinding>()
  const exportsByName = new Map<string, string>()
  const reExportBindingsByName = new Map<string, ImportBinding>()
  const exportAllBindings: ImportBinding[] = []

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

  return {
    importsByLocalName,
    exportsByName,
    reExportBindingsByName,
    exportAllBindings,
  }
}

describe('collectImportsAndExports', () => {
  describe('import bindings', () => {
    it('collects named import bindings', () => {
      const { importsByLocalName } = collect('import { Foo } from "./foo"', {
        sourceDeps: new Map([['./foo', '/src/foo.ts']]),
      })

      expect(importsByLocalName.get('Foo')).toEqual({
        importedName: 'Foo',
        sourceSpecifier: './foo',
        sourcePath: '/src/foo.ts',
      })
    })

    it('collects default import bindings', () => {
      const { importsByLocalName } = collect('import Foo from "./foo"')

      expect(importsByLocalName.get('Foo')).toEqual({
        importedName: 'default',
        sourceSpecifier: './foo',
      })
    })

    it('collects namespace import bindings', () => {
      const { importsByLocalName } = collect('import * as Ns from "./ns"')

      expect(importsByLocalName.get('Ns')).toEqual({
        importedName: '*',
        sourceSpecifier: './ns',
      })
    })

    it('skips type-only imports', () => {
      const { importsByLocalName } = collect('import type { Foo } from "./foo"')
      expect(importsByLocalName.size).toBe(0)
    })

    it('skips type-only import specifiers', () => {
      const { importsByLocalName } = collect(
        'import { type Foo, Bar } from "./foo"',
      )
      expect(importsByLocalName.has('Foo')).toBe(false)
      expect(importsByLocalName.has('Bar')).toBe(true)
    })

    it('collects renamed import bindings', () => {
      const { importsByLocalName } = collect(
        'import { Foo as MyFoo } from "./foo"',
      )

      expect(importsByLocalName.get('MyFoo')).toEqual({
        importedName: 'Foo',
        sourceSpecifier: './foo',
      })
    })
  })

  describe('named exports', () => {
    it('collects exported function declarations', () => {
      const symbols = new Map<string, PendingReactUsageNode>([
        ['App', createMockSymbol('App', 'component')],
      ])
      const { exportsByName } = collect('export function App() {}', {
        symbols,
      })

      expect(exportsByName.get('App')).toBe('test.tsx#component:App')
      expect(symbols.get('App')?.exportNames.has('App')).toBe(true)
    })

    it('collects exported variable declarations', () => {
      const symbols = new Map<string, PendingReactUsageNode>([
        ['App', createMockSymbol('App', 'component')],
      ])
      const { exportsByName } = collect('export const App = () => {}', {
        symbols,
      })

      expect(exportsByName.get('App')).toBe('test.tsx#component:App')
    })

    it('collects re-exports from source', () => {
      const { reExportBindingsByName } = collect(
        'export { Foo } from "./foo"',
        { sourceDeps: new Map([['./foo', '/src/foo.ts']]) },
      )

      expect(reExportBindingsByName.get('Foo')).toEqual({
        importedName: 'Foo',
        sourceSpecifier: './foo',
        sourcePath: '/src/foo.ts',
      })
    })

    it('collects renamed re-exports', () => {
      const { reExportBindingsByName } = collect(
        'export { Foo as Bar } from "./foo"',
      )

      expect(reExportBindingsByName.get('Bar')).toEqual({
        importedName: 'Foo',
        sourceSpecifier: './foo',
      })
    })

    it('skips type-only exports', () => {
      const { exportsByName, reExportBindingsByName } = collect(
        'export type { Foo } from "./foo"',
      )
      expect(exportsByName.size).toBe(0)
      expect(reExportBindingsByName.size).toBe(0)
    })

    it('skips type-only specifiers in re-exports', () => {
      const { reExportBindingsByName } = collect(
        'export { type Foo, Bar } from "./foo"',
      )
      expect(reExportBindingsByName.has('Foo')).toBe(false)
      expect(reExportBindingsByName.has('Bar')).toBe(true)
    })

    it('collects local named exports mapping to symbols', () => {
      const symbols = new Map<string, PendingReactUsageNode>([
        ['App', createMockSymbol('App', 'component')],
      ])
      const { exportsByName } = collect('export { App }', { symbols })

      expect(exportsByName.get('App')).toBe('test.tsx#component:App')
    })

    it('collects renamed local exports', () => {
      const symbols = new Map<string, PendingReactUsageNode>([
        ['App', createMockSymbol('App', 'component')],
      ])
      const { exportsByName } = collect('export { App as MyApp }', { symbols })

      expect(exportsByName.get('MyApp')).toBe('test.tsx#component:App')
    })

    it('ignores exports for names not in symbolsByName', () => {
      const { exportsByName } = collect('export { Unknown }')
      expect(exportsByName.size).toBe(0)
    })
  })

  describe('export all', () => {
    it('collects export all bindings', () => {
      const { exportAllBindings } = collect('export * from "./foo"', {
        sourceDeps: new Map([['./foo', '/src/foo.ts']]),
      })

      expect(exportAllBindings).toEqual([
        {
          importedName: '*',
          sourceSpecifier: './foo',
          sourcePath: '/src/foo.ts',
        },
      ])
    })

    it('skips type-only export all', () => {
      const { exportAllBindings } = collect('export type * from "./foo"')
      expect(exportAllBindings).toHaveLength(0)
    })

    it('omits sourcePath when not in sourceDependencies', () => {
      const { exportAllBindings } = collect('export * from "./foo"')
      expect(exportAllBindings[0]).toEqual({
        importedName: '*',
        sourceSpecifier: './foo',
      })
    })
  })

  describe('default exports', () => {
    it('collects default export of named function', () => {
      const symbols = new Map<string, PendingReactUsageNode>([
        ['App', createMockSymbol('App', 'component')],
      ])
      const { exportsByName } = collect('export default function App() {}', {
        symbols,
      })

      expect(exportsByName.get('default')).toBe('test.tsx#component:App')
    })

    it('collects default export of identifier referencing symbol', () => {
      const symbols = new Map<string, PendingReactUsageNode>([
        ['App', createMockSymbol('App', 'component')],
      ])
      const { exportsByName } = collect('export default App', { symbols })

      expect(exportsByName.get('default')).toBe('test.tsx#component:App')
    })

    it('creates re-export binding when default export is imported identifier', () => {
      const { reExportBindingsByName, importsByLocalName } = collect(
        'import App from "./app"\nexport default App',
      )

      expect(importsByLocalName.has('App')).toBe(true)
      expect(reExportBindingsByName.get('default')).toEqual({
        importedName: 'default',
        sourceSpecifier: './app',
      })
    })

    it('collects default export of arrow function with symbol', () => {
      const symbols = new Map<string, PendingReactUsageNode>([
        ['default', createMockSymbol('default', 'component')],
      ])
      const { exportsByName } = collect('export default () => null', {
        symbols,
      })

      expect(exportsByName.get('default')).toBe('test.tsx#component:default')
    })
  })

  it('ignores unrelated statement types', () => {
    const result = collect('const x = 42')
    expect(result.importsByLocalName.size).toBe(0)
    expect(result.exportsByName.size).toBe(0)
  })
})
