import { parseSync } from 'oxc-parser'
import { describe, expect, it } from 'vitest'

import type { PendingReactUsageNode } from './file.js'
import { analyzeSymbolUsages } from './usage.js'

function createSymbolFromCode(
  code: string,
  name: string,
  kind: 'component' | 'hook',
): PendingReactUsageNode {
  const { program } = parseSync('test.tsx', code)
  const stmt = program.body[0]

  let analysisRoot: PendingReactUsageNode['analysisRoot']
  if (stmt.type === 'FunctionDeclaration' && stmt.body !== null) {
    analysisRoot = stmt.body
  } else if (
    stmt.type === 'VariableDeclaration' &&
    stmt.declarations[0].init !== null
  ) {
    const init = stmt.declarations[0].init
    if (init.type === 'ArrowFunctionExpression') {
      analysisRoot = init.body as PendingReactUsageNode['analysisRoot']
    } else {
      analysisRoot = init as PendingReactUsageNode['analysisRoot']
    }
  } else {
    throw new Error(`Unsupported statement type: ${stmt.type}`)
  }

  return {
    id: `test.tsx#${kind}:${name}`,
    name,
    kind,
    filePath: 'test.tsx',
    declarationOffset: 0,
    analysisRoot,
    exportNames: new Set(),
    componentReferences: new Set(),
    hookReferences: new Set(),
    builtinReferences: new Set(),
  }
}

describe('analyzeSymbolUsages', () => {
  it('detects component references from JSX', () => {
    const symbol = createSymbolFromCode(
      'function App() { return <Child /> }',
      'App',
      'component',
    )
    analyzeSymbolUsages(symbol, false)

    expect(symbol.componentReferences.has('Child')).toBe(true)
  })

  it('detects hook references from call expressions', () => {
    const symbol = createSymbolFromCode(
      'function App() { useState(0); return <div /> }',
      'App',
      'component',
    )
    analyzeSymbolUsages(symbol, false)

    expect(symbol.hookReferences.has('useState')).toBe(true)
  })

  it('detects builtin references when includeBuiltins is true', () => {
    const symbol = createSymbolFromCode(
      'function App() { return <div /> }',
      'App',
      'component',
    )
    analyzeSymbolUsages(symbol, true)

    expect(symbol.builtinReferences.has('div')).toBe(true)
  })

  it('ignores builtin references when includeBuiltins is false', () => {
    const symbol = createSymbolFromCode(
      'function App() { return <div /> }',
      'App',
      'component',
    )
    analyzeSymbolUsages(symbol, false)

    expect(symbol.builtinReferences.size).toBe(0)
  })

  it('detects React.createElement component references', () => {
    const symbol = createSymbolFromCode(
      'function App() { return React.createElement(Child, null) }',
      'App',
      'component',
    )
    analyzeSymbolUsages(symbol, false)

    expect(symbol.componentReferences.has('Child')).toBe(true)
  })

  it('detects member expression component references', () => {
    const symbol = createSymbolFromCode(
      'function App() { return <Ns.Item /> }',
      'App',
      'component',
    )
    analyzeSymbolUsages(symbol, false)

    expect(symbol.componentReferences.has('Ns.Item')).toBe(true)
  })

  it('detects styled component references from call expressions', () => {
    const symbol = createSymbolFromCode(
      'function App() { const S = styled(Button)({}); return <S /> }',
      'App',
      'component',
    )
    analyzeSymbolUsages(symbol, false)

    expect(symbol.componentReferences.has('Button')).toBe(true)
  })

  it('detects styled builtin references when includeBuiltins is true', () => {
    const symbol = createSymbolFromCode(
      'function App() { const S = styled.div({}); return <S /> }',
      'App',
      'component',
    )
    analyzeSymbolUsages(symbol, true)

    expect(symbol.builtinReferences.has('div')).toBe(true)
  })

  it('ignores styled builtin references when includeBuiltins is false', () => {
    const symbol = createSymbolFromCode(
      'function App() { const S = styled.div({}); return <S /> }',
      'App',
      'component',
    )
    analyzeSymbolUsages(symbol, false)

    expect(symbol.builtinReferences.size).toBe(0)
  })

  it('detects styled component references from tagged templates', () => {
    const symbol = createSymbolFromCode(
      'function App() { const S = styled(Button)``; return <S /> }',
      'App',
      'component',
    )
    analyzeSymbolUsages(symbol, false)

    expect(symbol.componentReferences.has('Button')).toBe(true)
  })

  it('detects styled builtin from tagged templates when includeBuiltins is true', () => {
    const symbol = createSymbolFromCode(
      'function App() { const S = styled.div``; return <S /> }',
      'App',
      'component',
    )
    analyzeSymbolUsages(symbol, true)

    expect(symbol.builtinReferences.has('div')).toBe(true)
  })

  it('detects multiple references in the same function', () => {
    const symbol = createSymbolFromCode(
      'function App() { useEffect(() => {}); return <><Child /><Other /></> }',
      'App',
      'component',
    )
    analyzeSymbolUsages(symbol, false)

    expect(symbol.hookReferences.has('useEffect')).toBe(true)
    expect(symbol.componentReferences.has('Child')).toBe(true)
    expect(symbol.componentReferences.has('Other')).toBe(true)
  })
})
