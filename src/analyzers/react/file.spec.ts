import { describe, expect, it } from 'vitest'
import { parseSync } from 'oxc-parser'

import { analyzeReactFile } from './file.js'

function analyze(
  code: string,
  opts?: {
    includeNestedRenderEntries?: boolean
    sourceDependencies?: Map<string, string>
    includeBuiltins?: boolean
  },
) {
  const { program } = parseSync('test.tsx', code)
  return analyzeReactFile(
    program,
    '/test.tsx',
    code,
    opts?.includeNestedRenderEntries ?? true,
    opts?.sourceDependencies ?? new Map(),
    opts?.includeBuiltins ?? false,
  )
}

describe('analyzeReactFile', () => {
  it('detects component symbols from function declarations', () => {
    const result = analyze('function App() { return <div /> }')
    expect(result.symbolsByName.has('App')).toBe(true)
    expect(result.symbolsByName.get('App')!.kind).toBe('component')
  })

  it('detects hook symbols', () => {
    const result = analyze('function useData() { return null }')
    expect(result.symbolsByName.has('useData')).toBe(true)
    expect(result.symbolsByName.get('useData')!.kind).toBe('hook')
  })

  it('collects import bindings', () => {
    const result = analyze('import { useState } from "react"')
    expect(result.importsByLocalName.has('useState')).toBe(true)
    expect(result.importsByLocalName.get('useState')!.importedName).toBe(
      'useState',
    )
  })

  it('collects export bindings for symbols', () => {
    const result = analyze(
      'export function App() { return <div /> }',
    )
    expect(result.exportsByName.has('App')).toBe(true)
    expect(result.symbolsByName.get('App')!.exportNames.has('App')).toBe(true)
  })

  it('collects entry usages when includeNestedRenderEntries is true', () => {
    const result = analyze(
      '<App />\nfunction App() { return <div /> }',
      { includeNestedRenderEntries: true },
    )
    expect(result.entryUsages.length).toBeGreaterThan(0)
  })

  it('returns empty entry usages when includeNestedRenderEntries is false', () => {
    const result = analyze(
      '<App />\nfunction App() { return <div /> }',
      { includeNestedRenderEntries: false },
    )
    expect(result.entryUsages).toHaveLength(0)
  })

  it('analyzes symbol usages to populate references', () => {
    const result = analyze(
      'function App() { useState(); return <Child /> }',
    )
    const app = result.allSymbolsByName.get('App')!
    expect(app.hookReferences.has('useState')).toBe(true)
    expect(app.componentReferences.has('Child')).toBe(true)
  })

  it('maps source dependencies to import binding source paths', () => {
    const result = analyze('import { Foo } from "./foo"', {
      sourceDependencies: new Map([['./foo', '/src/foo.ts']]),
    })
    expect(result.importsByLocalName.get('Foo')!.sourcePath).toBe(
      '/src/foo.ts',
    )
  })

  it('includes dynamic component candidates in allSymbolsByName', () => {
    const result = analyze(
      'const LazyComp = lazy(() => import("./Comp"))',
    )
    expect(result.allSymbolsByName.has('LazyComp')).toBe(true)
    expect(result.symbolsByName.has('LazyComp')).toBe(false)
  })

  it('falls back to component declaration entries when no direct entries', () => {
    const result = analyze(
      'export function App() { return <div /> }',
      { includeNestedRenderEntries: true },
    )
    expect(result.entryUsages.length).toBeGreaterThan(0)
    expect(result.entryUsages[0].referenceName).toBe('App')
    expect(result.entryUsages[0].kind).toBe('component')
  })

  it('builds symbolsById from symbolsByName', () => {
    const result = analyze('function App() { return <div /> }')
    const app = result.symbolsByName.get('App')!
    expect(result.symbolsById.get(app.id)).toBe(app)
  })

  it('builds allSymbolsById from allSymbolsByName', () => {
    const result = analyze(
      'function App() { return <div /> }\nconst LazyComp = lazy(() => import("./Comp"))',
    )
    expect(result.allSymbolsById.size).toBeGreaterThanOrEqual(2)
  })

  it('sets filePath on the result', () => {
    const result = analyze('const x = 1')
    expect(result.filePath).toBe('/test.tsx')
  })

  it('collects re-export bindings', () => {
    const result = analyze('export { Foo } from "./foo"', {
      sourceDependencies: new Map([['./foo', '/src/foo.ts']]),
    })
    expect(result.reExportBindingsByName.has('Foo')).toBe(true)
  })

  it('collects export all bindings', () => {
    const result = analyze('export * from "./foo"')
    expect(result.exportAllBindings).toHaveLength(1)
  })

  it('includes builtin references when includeBuiltins is true', () => {
    const result = analyze('function App() { return <div /> }', {
      includeBuiltins: true,
    })
    const app = result.allSymbolsByName.get('App')!
    expect(app.builtinReferences.has('div')).toBe(true)
  })
})
