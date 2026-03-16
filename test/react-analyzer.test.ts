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
const monorepoFixtureDirectory = path.join(
  currentDirectory,
  'fixtures',
  'monorepo',
  'packages',
  'app',
)

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
    expect(output).not.toContain('<button> [builtin] (html)')
    expect(output).not.toContain('<Current /> [component]')
  })

  it('can include built-in HTML nodes when requested', () => {
    const graph = analyzeReactUsage('src/main.tsx', {
      cwd: fixtureDirectory,
      includeBuiltins: true,
    })

    const output = printReactUsageTree(graph, {
      color: false,
    })
    const jsonTree = graphToSerializableReactTree(graph)

    expect(output).toContain(
      '<Button /> as PrimaryButton [component] (src/components/Button.tsx)',
    )
    expect(output).toContain('<button> [builtin] (html)')
    expect(jsonTree).toMatchObject({
      roots: expect.arrayContaining([
        expect.objectContaining({
          name: 'AppShell',
          usages: expect.arrayContaining([
            expect.objectContaining({
              referenceName: 'PrimaryPanel',
              node: expect.objectContaining({
                name: 'Panel',
                usages: expect.arrayContaining([
                  expect.objectContaining({
                    referenceName: 'PrimaryButton',
                    node: expect.objectContaining({
                      name: 'Button',
                      usages: expect.arrayContaining([
                        expect.objectContaining({
                          kind: 'render',
                          referenceName: 'button',
                          node: expect.objectContaining({
                            name: 'button',
                            symbolKind: 'builtin',
                            filePath: 'html',
                          }),
                        }),
                      ]),
                    }),
                  }),
                ]),
              }),
            }),
          ]),
        }),
      ]),
    })
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

  it('includes CSS-in-JS generated components in ASCII and JSON output', () => {
    const graph = analyzeReactUsage('src/styled-entry.tsx', {
      cwd: fixtureDirectory,
      includeBuiltins: true,
    })

    const output = printReactUsageTree(graph, {
      color: false,
    })
    const jsonTree = graphToSerializableReactTree(graph)

    expect(output).toContain(
      '<StyledEntry /> [component] (src/styled-entry.tsx)',
    )
    expect(output).toContain('<Section /> [component] (src/styled-entry.tsx)')
    expect(output).toContain('<Button /> [component] (src/styled-entry.tsx)')
    expect(output).toContain('<Card /> [component] (src/styled-entry.tsx)')
    expect(output).toContain(
      '<LinkButton /> [component] (src/styled-entry.tsx)',
    )
    expect(output).toContain('<MemoLink /> [component] (src/styled-entry.tsx)')
    expect(output).toContain(
      '<BaseCard /> [component] (src/components/BaseCard.tsx)',
    )
    expect(output).toContain('<Link /> [component] (src/components/Link.tsx)')
    expect(output).toContain('<div> [builtin] (html)')
    expect(output).toContain('<button> [builtin] (html)')

    expect(jsonTree).toMatchObject({
      entries: [
        expect.objectContaining({
          referenceName: 'StyledEntry',
          node: expect.objectContaining({
            name: 'StyledEntry',
            symbolKind: 'component',
          }),
        }),
      ],
      roots: [
        expect.objectContaining({
          name: 'StyledEntry',
          usages: expect.arrayContaining([
            expect.objectContaining({
              node: expect.objectContaining({
                name: 'Section',
                symbolKind: 'component',
                usages: expect.arrayContaining([
                  expect.objectContaining({
                    node: expect.objectContaining({
                      name: 'div',
                      symbolKind: 'builtin',
                    }),
                  }),
                ]),
              }),
            }),
            expect.objectContaining({
              node: expect.objectContaining({
                name: 'Button',
                symbolKind: 'component',
                usages: expect.arrayContaining([
                  expect.objectContaining({
                    node: expect.objectContaining({
                      name: 'button',
                      symbolKind: 'builtin',
                    }),
                  }),
                ]),
              }),
            }),
            expect.objectContaining({
              node: expect.objectContaining({
                name: 'Card',
                symbolKind: 'component',
                usages: expect.arrayContaining([
                  expect.objectContaining({
                    node: expect.objectContaining({
                      name: 'BaseCard',
                      symbolKind: 'component',
                    }),
                  }),
                ]),
              }),
            }),
            expect.objectContaining({
              node: expect.objectContaining({
                name: 'LinkButton',
                symbolKind: 'component',
                usages: expect.arrayContaining([
                  expect.objectContaining({
                    node: expect.objectContaining({
                      name: 'Link',
                      symbolKind: 'component',
                    }),
                  }),
                ]),
              }),
            }),
            expect.objectContaining({
              node: expect.objectContaining({
                name: 'MemoLink',
                symbolKind: 'component',
                usages: expect.arrayContaining([
                  expect.objectContaining({
                    node: expect.objectContaining({
                      name: 'Link',
                      symbolKind: 'component',
                    }),
                  }),
                ]),
              }),
            }),
          ]),
        }),
      ],
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

  it('falls back to the entry component declaration when the file only renders inside that component', () => {
    const graph = analyzeReactUsage('src/entry-page.tsx', {
      cwd: fixtureDirectory,
    })

    const output = printReactUsageTree(graph, {
      color: false,
      filter: 'component',
    })

    expect(output).toContain('src/entry-page.tsx:4:25')
    expect(output).toContain('<EntryPage /> [component] (src/entry-page.tsx)')
    expect(output).toContain('<Panel /> [component] (src/components/Panel.tsx)')
    expect(output).toContain(
      '<DynamicHost /> [component] (src/components/DynamicHost.tsx)',
    )
  })

  it('includes hook usages under the entry component declaration fallback', () => {
    const graph = analyzeReactUsage('src/entry-hook-page.tsx', {
      cwd: fixtureDirectory,
    })

    const output = printReactUsageTree(graph, {
      color: false,
    })

    expect(output).toContain('src/entry-hook-page.tsx:6:25')
    expect(output).toContain(
      '<EntryHookPage /> [component] (src/entry-hook-page.tsx)',
    )
    expect(output).toContain('<Panel /> [component] (src/components/Panel.tsx)')
    expect(output).toContain('useEffect() [hook] (react)')
    expect(output).toContain('useFeature() [hook] (src/hooks/useFeature.ts)')
  })

  it('returns JSON entries for the entry component declaration fallback', () => {
    const graph = analyzeReactUsage('src/entry-hook-page.tsx', {
      cwd: fixtureDirectory,
    })

    const jsonTree = graphToSerializableReactTree(graph)

    expect(jsonTree).toMatchObject({
      entries: [
        expect.objectContaining({
          filePath: 'src/entry-hook-page.tsx',
          line: 6,
          column: 25,
          node: expect.objectContaining({
            name: 'EntryHookPage',
            symbolKind: 'component',
          }),
        }),
      ],
      roots: [
        expect.objectContaining({
          name: 'EntryHookPage',
          usages: expect.arrayContaining([
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
      ],
    })
  })

  it('can colorize component and hook labels when requested', () => {
    const graph = analyzeReactUsage('src/main.tsx', {
      cwd: fixtureDirectory,
      includeBuiltins: true,
    })

    const output = printReactUsageTree(graph, {
      color: true,
    })

    expect(output).toContain('\u001B[36m<AppShell /> [component]\u001B[0m')
    expect(output).toContain('\u001B[35museFeature() [hook]\u001B[0m')
    expect(output).toContain('\u001B[34m<button> [builtin]\u001B[0m')
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

    expect(output).toContain('src/aliased-entry.tsx:3:17')
    expect(output).toContain(
      '<AliasedEntry /> [component] (src/aliased-entry.tsx)',
    )
    expect(output).toContain(
      '<OriginalButton /> as AliasButton [component] (src/components/AliasedButton.tsx)',
    )
    expect(jsonTree).toMatchObject({
      entries: [
        expect.objectContaining({
          referenceName: 'AliasedEntry',
          node: expect.objectContaining({
            name: 'AliasedEntry',
            symbolKind: 'component',
          }),
        }),
      ],
      roots: [
        expect.objectContaining({
          name: 'AliasedEntry',
          usages: [
            expect.objectContaining({
              referenceName: 'AliasButton',
              node: expect.objectContaining({
                name: 'OriginalButton',
                symbolKind: 'component',
              }),
            }),
          ],
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

    expect(output).not.toContain('src/aliased-hook-entry.tsx:')
    expect(output).toContain('useFeature() [hook] (src/hooks/useFeature.ts)')
    expect(jsonTree).toMatchObject({
      entries: [],
      roots: [
        expect.objectContaining({
          name: 'useFeature',
          usages: [
            expect.objectContaining({
              kind: 'hook-call',
              referenceName: 'usePanelStateAlias',
              node: expect.objectContaining({
                name: 'usePanelState',
                symbolKind: 'hook',
              }),
            }),
          ],
        }),
      ],
    })
  })

  it('resolves hooks that are re-exported through export-all barrels', () => {
    const graph = analyzeReactUsage('src/reexported-hook-entry.tsx', {
      cwd: fixtureDirectory,
    })

    const output = printReactUsageTree(graph, {
      color: false,
      filter: 'hook',
    })
    const jsonTree = graphToSerializableReactTree(graph, {
      filter: 'hook',
    })

    expect(output).toContain(
      'useLibraryHook() [hook] (src/reexported-hooks/useLibraryHook.ts)',
    )
    expect(jsonTree).toMatchObject({
      roots: [
        expect.objectContaining({
          name: 'useLibraryHook',
          filePath: 'src/reexported-hooks/useLibraryHook.ts',
        }),
      ],
    })
  })

  it('includes sibling workspace React components and hooks by default', () => {
    const graph = analyzeReactUsage('src/main.tsx', {
      cwd: monorepoFixtureDirectory,
    })

    const output = printReactUsageTree(graph, {
      color: false,
    })
    const jsonTree = graphToSerializableReactTree(graph)

    expect(output).toContain('<App /> [component] (src/main.tsx)')
    expect(output).toContain(
      `<SharedPanel /> [component] (${path.join(
        monorepoFixtureDirectory,
        '..',
        'ui',
        'src',
        'components',
        'SharedPanel.tsx',
      )})`,
    )
    expect(output).toContain(
      `useSharedPanelState() [hook] (${path.join(
        monorepoFixtureDirectory,
        '..',
        'ui',
        'src',
        'internal',
        'useSharedPanelState.ts',
      )})`,
    )
    expect(jsonTree).toMatchObject({
      roots: [
        expect.objectContaining({
          name: 'App',
          usages: [
            expect.objectContaining({
              kind: 'render',
              node: expect.objectContaining({
                name: 'SharedPanel',
                filePath: path.join(
                  monorepoFixtureDirectory,
                  '..',
                  'ui',
                  'src',
                  'components',
                  'SharedPanel.tsx',
                ),
                usages: [
                  expect.objectContaining({
                    kind: 'hook-call',
                    node: expect.objectContaining({
                      name: 'useSharedPanelState',
                      symbolKind: 'hook',
                    }),
                  }),
                ],
              }),
            }),
          ],
        }),
      ],
    })
  })
})
