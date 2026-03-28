import { describe, expect, it } from 'vitest'
import { parseSync } from 'oxc-parser'

import type { PendingReactUsageNode } from './file.js'
import {
  collectTopLevelDynamicComponentCandidates,
  collectTopLevelReactSymbols,
} from './symbols.js'

function collectSymbols(code: string) {
  const { program } = parseSync('test.tsx', code)
  const symbolsByName = new Map<string, PendingReactUsageNode>()
  program.body.forEach((statement) => {
    collectTopLevelReactSymbols(statement, '/test.tsx', symbolsByName)
  })
  return symbolsByName
}

function collectDynamicCandidates(code: string) {
  const { program } = parseSync('test.tsx', code)
  const symbolsByName = new Map<string, PendingReactUsageNode>()
  const dynamicCandidates = new Map<string, PendingReactUsageNode>()

  program.body.forEach((statement) => {
    collectTopLevelReactSymbols(statement, '/test.tsx', symbolsByName)
  })
  program.body.forEach((statement) => {
    collectTopLevelDynamicComponentCandidates(
      statement,
      '/test.tsx',
      symbolsByName,
      dynamicCandidates,
    )
  })

  return { symbolsByName, dynamicCandidates }
}

describe('collectTopLevelReactSymbols', () => {
  it('detects function declaration component returning JSX', () => {
    const symbols = collectSymbols('function App() { return <div /> }')
    const app = symbols.get('App')
    expect(app).toBeDefined()
    expect(app!.kind).toBe('component')
    expect(app!.id).toBe('/test.tsx#component:App')
  })

  it('detects function declaration hook', () => {
    const symbols = collectSymbols('function useData() { return null }')
    const hook = symbols.get('useData')
    expect(hook).toBeDefined()
    expect(hook!.kind).toBe('hook')
  })

  it('detects arrow function component returning JSX', () => {
    const symbols = collectSymbols('const App = () => <div />')
    const app = symbols.get('App')
    expect(app).toBeDefined()
    expect(app!.kind).toBe('component')
  })

  it('detects arrow function hook', () => {
    const symbols = collectSymbols('const useData = () => { return null }')
    expect(symbols.get('useData')).toBeDefined()
    expect(symbols.get('useData')!.kind).toBe('hook')
  })

  it('detects styled-component variable', () => {
    const symbols = collectSymbols('const Button = styled.button``')
    expect(symbols.get('Button')).toBeDefined()
    expect(symbols.get('Button')!.kind).toBe('component')
  })

  it('ignores non-react functions', () => {
    const symbols = collectSymbols('function helper() { return 42 }')
    expect(symbols.size).toBe(0)
  })

  it('ignores lowercase function names as components', () => {
    const symbols = collectSymbols('function app() { return <div /> }')
    expect(symbols.size).toBe(0)
  })

  it('ignores variable without initializer', () => {
    const symbols = collectSymbols('let App')
    expect(symbols.size).toBe(0)
  })

  it('ignores destructured variables', () => {
    const symbols = collectSymbols('const { App } = obj')
    expect(symbols.size).toBe(0)
  })

  it('detects exported function declarations', () => {
    const symbols = collectSymbols('export function App() { return <div /> }')
    expect(symbols.get('App')).toBeDefined()
  })

  it('detects default exported named function', () => {
    const symbols = collectSymbols(
      'export default function App() { return <div /> }',
    )
    expect(symbols.get('App')).toBeDefined()
    expect(symbols.get('App')!.kind).toBe('component')
  })

  it('does not classify anonymous default arrow function as component', () => {
    const symbols = collectSymbols(
      'export default () => { return <div /> }',
    )
    expect(symbols.get('default')).toBeUndefined()
  })

  it('initializes pending symbol with empty sets', () => {
    const symbols = collectSymbols('function useData() {}')
    const hook = symbols.get('useData')!
    expect(hook.exportNames.size).toBe(0)
    expect(hook.componentReferences.size).toBe(0)
    expect(hook.hookReferences.size).toBe(0)
    expect(hook.builtinReferences.size).toBe(0)
  })

  it('ignores unrelated statement types', () => {
    const symbols = collectSymbols('const x = 42')
    expect(symbols.size).toBe(0)
  })
})

describe('collectTopLevelDynamicComponentCandidates', () => {
  it('detects call expression dynamic candidate', () => {
    const { dynamicCandidates } = collectDynamicCandidates(
      'const LazyComp = lazy(() => import("./Comp"))',
    )
    expect(dynamicCandidates.get('LazyComp')).toBeDefined()
    expect(dynamicCandidates.get('LazyComp')!.kind).toBe('component')
  })

  it('ignores names already in symbolsByName', () => {
    const code = [
      'function App() { return <div /> }',
      'const App2 = lazy(() => import("./App"))',
    ].join('\n')
    const { program } = parseSync('test.tsx', code)
    const symbolsByName = new Map<string, PendingReactUsageNode>()
    const dynamicCandidates = new Map<string, PendingReactUsageNode>()

    program.body.forEach((statement) => {
      collectTopLevelReactSymbols(statement, '/test.tsx', symbolsByName)
    })

    const appSymbol = symbolsByName.get('App')!
    symbolsByName.set('App2', appSymbol)

    program.body.forEach((statement) => {
      collectTopLevelDynamicComponentCandidates(
        statement,
        '/test.tsx',
        symbolsByName,
        dynamicCandidates,
      )
    })

    expect(dynamicCandidates.has('App2')).toBe(false)
  })

  it('ignores lowercase names', () => {
    const { dynamicCandidates } = collectDynamicCandidates(
      'const lazyComp = lazy(() => import("./Comp"))',
    )
    expect(dynamicCandidates.size).toBe(0)
  })

  it('ignores names with underscores', () => {
    const { dynamicCandidates } = collectDynamicCandidates(
      'const Comp_A = lazy(() => import("./Comp"))',
    )
    expect(dynamicCandidates.size).toBe(0)
  })

  it('handles exported variable declarations', () => {
    const { dynamicCandidates } = collectDynamicCandidates(
      'export const LazyComp = lazy(() => import("./Comp"))',
    )
    expect(dynamicCandidates.get('LazyComp')).toBeDefined()
  })

  it('ignores non-call/non-tagged-template initializers', () => {
    const { dynamicCandidates } = collectDynamicCandidates(
      'const LazyComp = someValue',
    )
    expect(dynamicCandidates.size).toBe(0)
  })
})
