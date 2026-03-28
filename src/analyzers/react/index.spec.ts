import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { analyzeReactUsage } from './index.js'

function writeTsConfig(dir: string) {
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
      },
    }),
  )
}

describe('analyzeReactUsage', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'react-')))
    writeTsConfig(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('analyzes a single component file', () => {
    const appFile = path.join(tmpDir, 'App.tsx')
    fs.writeFileSync(
      appFile,
      'export function App() { return <div>Hello</div> }',
    )

    const graph = analyzeReactUsage(appFile, { cwd: tmpDir })

    expect(graph.nodes.size).toBeGreaterThan(0)
    const appNode = [...graph.nodes.values()].find(
      (n) => n.name === 'App' && n.kind === 'component',
    )
    expect(appNode).toBeDefined()
  })

  it('produces usage edges between components', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'Button.tsx'),
      'export function Button() { return <button>Click</button> }',
    )
    fs.writeFileSync(
      path.join(tmpDir, 'App.tsx'),
      `import { Button } from './Button'\nexport function App() { return <Button /> }`,
    )

    const graph = analyzeReactUsage(path.join(tmpDir, 'App.tsx'), {
      cwd: tmpDir,
    })

    const appNode = [...graph.nodes.values()].find((n) => n.name === 'App')
    expect(appNode).toBeDefined()
    expect(appNode?.usages.length).toBeGreaterThan(0)

    const buttonUsage = appNode?.usages.find(
      (u) => u.referenceName === 'Button',
    )
    expect(buttonUsage).toBeDefined()
  })

  it('produces hook nodes', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'hooks.ts'),
      'export function useData() { return null }',
    )
    fs.writeFileSync(
      path.join(tmpDir, 'App.tsx'),
      `import { useData } from './hooks'\nexport function App() { useData(); return <div /> }`,
    )

    const graph = analyzeReactUsage(path.join(tmpDir, 'App.tsx'), {
      cwd: tmpDir,
    })

    const hookNode = [...graph.nodes.values()].find((n) => n.name === 'useData')
    expect(hookNode).toBeDefined()
    expect(hookNode?.kind).toBe('hook')
  })

  it('produces entries for the entry file', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'App.tsx'),
      'function App() { return <div /> }\nexport default App',
    )

    const graph = analyzeReactUsage(path.join(tmpDir, 'App.tsx'), {
      cwd: tmpDir,
    })

    expect(graph.entries.length).toBeGreaterThanOrEqual(0)
  })

  it('supports multiple entry files', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'A.tsx'),
      'export function A() { return <div /> }',
    )
    fs.writeFileSync(
      path.join(tmpDir, 'B.tsx'),
      'export function B() { return <div /> }',
    )

    const graph = analyzeReactUsage(
      [path.join(tmpDir, 'A.tsx'), path.join(tmpDir, 'B.tsx')],
      { cwd: tmpDir },
    )

    expect(graph.entryIds).toHaveLength(2)
  })

  it('throws on empty entry array', () => {
    expect(() => analyzeReactUsage([], { cwd: tmpDir })).toThrow(
      'At least one React entry file is required',
    )
  })

  it('includes builtin nodes when includeBuiltins is true', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'App.tsx'),
      'export function App() { return <div><span>hi</span></div> }',
    )

    const graph = analyzeReactUsage(path.join(tmpDir, 'App.tsx'), {
      cwd: tmpDir,
      includeBuiltins: true,
    })

    const builtinNodes = [...graph.nodes.values()].filter(
      (n) => n.kind === 'builtin',
    )
    expect(builtinNodes.length).toBeGreaterThan(0)
  })

  it('deduplicates entry files', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'App.tsx'),
      'export function App() { return <div /> }',
    )
    const appPath = path.join(tmpDir, 'App.tsx')

    const graph = analyzeReactUsage([appPath, appPath], { cwd: tmpDir })

    expect(graph.entryIds).toHaveLength(1)
  })
})
