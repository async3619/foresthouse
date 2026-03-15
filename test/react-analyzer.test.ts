import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  analyzeReactUsage,
  graphToSerializableReactTree,
  printReactUsageTree,
} from '../src/index.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const fixtureDirectory = path.join(currentDirectory, 'fixtures', 'react-mode')

describe('analyzeReactUsage', () => {
  it('builds a component and hook usage tree', () => {
    const graph = analyzeReactUsage('src/main.tsx', {
      cwd: fixtureDirectory,
    })

    const output = printReactUsageTree(graph, {
      color: false,
    })

    expect(output).toContain('AppShell [component] (src/AppShell.tsx)')
    expect(output).toContain('Panel [component] (src/components/Panel.tsx)')
    expect(output).toContain('Button [component] (src/components/Button.tsx)')
    expect(output).toContain('useEffect [hook] (react)')
    expect(output).toContain('useFeature [hook] (src/hooks/useFeature.ts)')
    expect(output).toContain(
      'usePanelState [hook] (src/hooks/usePanelState.ts)',
    )
    expect(output).not.toContain('Current [component]')
  })

  it('can filter the tree by component or hook', () => {
    const graph = analyzeReactUsage('src/main.tsx', {
      cwd: fixtureDirectory,
    })

    const componentOutput = printReactUsageTree(graph, {
      color: false,
      filter: 'component',
    })
    const hookOutput = printReactUsageTree(graph, {
      color: false,
      filter: 'hook',
    })

    expect(componentOutput).toContain('AppShell [component] (src/AppShell.tsx)')
    expect(componentOutput).toContain(
      'Panel [component] (src/components/Panel.tsx)',
    )
    expect(componentOutput).not.toContain('useFeature [hook]')

    expect(hookOutput).toContain('useEffect [hook] (react)')
    expect(hookOutput).toContain('useFeature [hook] (src/hooks/useFeature.ts)')
    expect(hookOutput).toContain(
      'usePanelState [hook] (src/hooks/usePanelState.ts)',
    )
    expect(hookOutput).not.toContain('AppShell [component]')
  })

  it('returns JSON with symbol metadata and nested usages', () => {
    const graph = analyzeReactUsage('src/main.tsx', {
      cwd: fixtureDirectory,
    })

    const jsonTree = graphToSerializableReactTree(graph)

    expect(jsonTree).toMatchObject({
      kind: 'react-usage',
      roots: expect.arrayContaining([
        expect.objectContaining({
          name: 'AppShell',
          symbolKind: 'component',
          filePath: 'src/AppShell.tsx',
          usages: expect.arrayContaining([
            expect.objectContaining({
              kind: 'render',
              node: expect.objectContaining({
                name: 'DynamicHost',
                symbolKind: 'component',
              }),
            }),
            expect.objectContaining({
              kind: 'render',
              node: expect.objectContaining({
                name: 'Panel',
                symbolKind: 'component',
              }),
            }),
            expect.objectContaining({
              kind: 'hook-call',
              node: expect.objectContaining({
                name: 'useEffect',
                symbolKind: 'hook',
              }),
            }),
            expect.objectContaining({
              kind: 'hook-call',
              node: expect.objectContaining({
                name: 'useFeature',
                symbolKind: 'hook',
              }),
            }),
          ]),
        }),
      ]),
    })
  })

  it('can colorize component and hook labels when requested', () => {
    const graph = analyzeReactUsage('src/main.tsx', {
      cwd: fixtureDirectory,
    })

    const output = printReactUsageTree(graph, {
      color: true,
    })

    expect(output).toContain('\u001B[36mAppShell [component]\u001B[0m')
    expect(output).toContain('\u001B[35museFeature [hook]\u001B[0m')
  })
})
