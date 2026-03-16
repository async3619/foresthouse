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

    expect(output).toContain('src/main.tsx:3:7')
    expect(output).toContain('<AppShell /> [component] (src/AppShell.tsx)')
    expect(output).toContain(
      '<Panel /> as PrimaryPanel [component] (src/components/Panel.tsx)',
    )
    expect(output).toContain(
      '<Button /> as PrimaryButton [component] (src/components/Button.tsx)',
    )
    expect(output).toContain('useEffect() [hook] (react)')
    expect(output).toContain('useFeature() [hook] (src/hooks/useFeature.ts)')
    expect(output).toContain(
      'usePanelState() as usePanelStateAlias [hook] (src/hooks/usePanelState.ts)',
    )
    expect(output).not.toContain('<Current /> [component]')
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

    expect(componentOutput).toContain('src/main.tsx:3:7')
    expect(componentOutput).toContain(
      '<AppShell /> [component] (src/AppShell.tsx)',
    )
    expect(componentOutput).toContain(
      '<Panel /> as PrimaryPanel [component] (src/components/Panel.tsx)',
    )
    expect(componentOutput).not.toContain('useFeature() [hook]')

    expect(hookOutput).not.toContain('src/main.tsx:3:7')
    expect(hookOutput).toContain('useEffect() [hook] (react)')
    expect(hookOutput).toContain(
      'useFeature() [hook] (src/hooks/useFeature.ts)',
    )
    expect(hookOutput).toContain(
      'usePanelState() as usePanelStateAlias [hook] (src/hooks/usePanelState.ts)',
    )
    expect(hookOutput).not.toContain('<AppShell /> [component]')
  })

  it('returns JSON with entry metadata and nested usages', () => {
    const graph = analyzeReactUsage('src/main.tsx', {
      cwd: fixtureDirectory,
    })

    const jsonTree = graphToSerializableReactTree(graph)

    expect(jsonTree).toMatchObject({
      kind: 'react-usage',
      entries: expect.arrayContaining([
        expect.objectContaining({
          filePath: 'src/main.tsx',
          line: 3,
          column: 7,
          node: expect.objectContaining({
            name: 'AppShell',
            symbolKind: 'component',
          }),
        }),
      ]),
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
              referenceName: 'PrimaryPanel',
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
              referenceName: 'useFeature',
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

  it('prints multiple React entry locations when the entry file renders more than one root', () => {
    const graph = analyzeReactUsage('src/multi-entry.tsx', {
      cwd: fixtureDirectory,
    })

    const output = printReactUsageTree(graph, {
      filter: 'component',
    })

    expect(output).toContain('src/multi-entry.tsx:4:7')
    expect(output).toContain('src/multi-entry.tsx:5:7')
    expect(output).toContain('<AppShell /> [component] (src/AppShell.tsx)')
    expect(output).toContain('<Panel /> [component] (src/components/Panel.tsx)')
  })

  it('treats renders inside the entry component file as React entry locations', () => {
    const graph = analyzeReactUsage('src/entry-page.tsx', {
      cwd: fixtureDirectory,
    })

    const output = printReactUsageTree(graph, {
      color: false,
      filter: 'component',
    })

    expect(output).toContain('src/entry-page.tsx:7:7')
    expect(output).toContain('src/entry-page.tsx:8:7')
    expect(output).toContain('<Panel /> [component] (src/components/Panel.tsx)')
    expect(output).toContain(
      '<DynamicHost /> [component] (src/components/DynamicHost.tsx)',
    )
    expect(output).not.toContain(
      '<EntryPage /> [component] (src/entry-page.tsx)',
    )
  })

  it('treats hook calls inside the entry component file as React entry locations', () => {
    const graph = analyzeReactUsage('src/entry-hook-page.tsx', {
      cwd: fixtureDirectory,
    })

    const output = printReactUsageTree(graph, {
      color: false,
      filter: 'hook',
    })

    expect(output).toContain('src/entry-hook-page.tsx:7:3')
    expect(output).toContain('src/entry-hook-page.tsx:8:3')
    expect(output).toContain('useEffect() [hook] (react)')
    expect(output).toContain('useFeature() [hook] (src/hooks/useFeature.ts)')
    expect(output).not.toContain(
      '<Panel /> [component] (src/components/Panel.tsx)',
    )
  })

  it('returns JSON entries for hook usages inside the entry component file', () => {
    const graph = analyzeReactUsage('src/entry-hook-page.tsx', {
      cwd: fixtureDirectory,
    })

    const jsonTree = graphToSerializableReactTree(graph, {
      filter: 'hook',
    })

    expect(jsonTree).toMatchObject({
      kind: 'react-usage',
      entries: expect.arrayContaining([
        expect.objectContaining({
          filePath: 'src/entry-hook-page.tsx',
          line: 7,
          column: 3,
          node: expect.objectContaining({
            name: 'useEffect',
            symbolKind: 'hook',
          }),
        }),
        expect.objectContaining({
          filePath: 'src/entry-hook-page.tsx',
          line: 8,
          column: 3,
          node: expect.objectContaining({
            name: 'useFeature',
            symbolKind: 'hook',
          }),
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

    expect(output).toContain('\u001B[36m<AppShell /> [component]\u001B[0m')
    expect(output).toContain('\u001B[35museFeature() [hook]\u001B[0m')
    expect(output).toContain(
      '\u001B[36m<Panel />\u001B[0m \u001B[38;5;244mas PrimaryPanel\u001B[0m \u001B[36m[component]\u001B[0m',
    )
  })

  it('shows aliased component names in tree and JSON output', () => {
    const graph = analyzeReactUsage('src/aliased-entry.tsx', {
      cwd: fixtureDirectory,
    })

    const output = printReactUsageTree(graph, {
      color: false,
      filter: 'component',
    })
    const jsonTree = graphToSerializableReactTree(graph, {
      filter: 'component',
    })

    expect(output).toContain('src/aliased-entry.tsx:4:10')
    expect(output).toContain(
      '<OriginalButton /> as AliasButton [component] (src/components/AliasedButton.tsx)',
    )
    expect(jsonTree).toMatchObject({
      entries: [
        expect.objectContaining({
          referenceName: 'AliasButton',
          node: expect.objectContaining({
            name: 'OriginalButton',
            symbolKind: 'component',
          }),
        }),
      ],
      roots: [
        expect.objectContaining({
          name: 'OriginalButton',
        }),
      ],
    })
  })

  it('shows aliased hook names in tree and JSON output', () => {
    const graph = analyzeReactUsage('src/aliased-hook-entry.tsx', {
      cwd: fixtureDirectory,
    })

    const output = printReactUsageTree(graph, {
      color: false,
      filter: 'hook',
    })
    const jsonTree = graphToSerializableReactTree(graph, {
      filter: 'hook',
    })

    expect(output).toContain('src/aliased-hook-entry.tsx:4:3')
    expect(output).toContain(
      'useFeature() as useAliasedFeature [hook] (src/hooks/useFeature.ts)',
    )
    expect(jsonTree).toMatchObject({
      entries: [
        expect.objectContaining({
          referenceName: 'useAliasedFeature',
          node: expect.objectContaining({
            name: 'useFeature',
            symbolKind: 'hook',
          }),
        }),
      ],
      roots: [
        expect.objectContaining({
          name: 'useFeature',
        }),
      ],
    })
  })
})
