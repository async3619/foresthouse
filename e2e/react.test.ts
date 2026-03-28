import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { main } from '../src/app/cli.js'
import {
  discoverNextJsPageEntries,
  resolveReactEntryFiles,
} from '../src/app/react-entry-files.js'
import { runCli } from '../src/app/run.js'
import {
  analyzeReactUsage,
  analyzeReactUsageDiff,
  diffGraphToSerializableReactTree,
  graphToSerializableReactTree,
  printReactUsageDiffTree,
  printReactUsageTree,
} from '../src/index.js'

vi.mock('../src/app/run.js', () => ({
  runCli: vi.fn(),
}))

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const fixtureDirectory = path.join(
  currentDirectory,
  '..',
  'test',
  'fixtures',
  'react-mode',
)
const monorepoFixtureDirectory = path.join(
  currentDirectory,
  '..',
  'test',
  'fixtures',
  'monorepo',
  'packages',
  'app',
)
const nextjsFixtureDirectory = path.join(
  currentDirectory,
  '..',
  'test',
  'fixtures',
  'nextjs-mode',
)
const temporaryDirectories: string[] = []
const GIT_EXEC_MAX_BUFFER = 64 * 1024 * 1024

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true })
  })
})

beforeEach(() => {
  vi.mocked(runCli).mockReset()
})

describe('react command options', () => {
  it('passes parsed react options to the CLI runner', () => {
    main('1.2.3', [
      'react',
      'src/main.tsx',
      '--cwd',
      'test/fixtures/react-mode',
      '--config',
      'tsconfig.json',
      '--no-workspaces',
      '--project-only',
      '--json',
      '--builtin',
      '--diff',
      'HEAD~1',
      '--filter',
      'hook',
    ])

    expect(runCli).toHaveBeenCalledWith({
      command: 'react',
      entryFile: 'src/main.tsx',
      diff: 'HEAD~1',
      cwd: 'test/fixtures/react-mode',
      configPath: 'tsconfig.json',
      expandWorkspaces: false,
      projectOnly: true,
      json: true,
      filter: 'hook',
      includeBuiltins: true,
      nextjs: false,
    })
  })

  it('allows react --nextjs without an explicit entry file', () => {
    main('1.2.3', ['react', '--nextjs', '--cwd', 'test/fixtures/nextjs-mode'])

    expect(runCli).toHaveBeenCalledWith({
      command: 'react',
      entryFile: undefined,
      diff: undefined,
      cwd: 'test/fixtures/nextjs-mode',
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: false,
      filter: 'all',
      includeBuiltins: false,
      nextjs: true,
    })
  })

  it('uses all react usages by default', () => {
    main('1.2.3', ['react', 'src/main.tsx'])

    expect(runCli).toHaveBeenCalledWith({
      command: 'react',
      entryFile: 'src/main.tsx',
      diff: undefined,
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: false,
      filter: 'all',
      includeBuiltins: false,
      nextjs: false,
    })
  })

  it('preserves an explicit react entry when --nextjs is also provided', () => {
    main('1.2.3', ['react', 'pages/index.tsx', '--nextjs'])

    expect(runCli).toHaveBeenCalledWith({
      command: 'react',
      entryFile: 'pages/index.tsx',
      diff: undefined,
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: false,
      filter: 'all',
      includeBuiltins: false,
      nextjs: true,
    })
  })
})

describe('react entry discovery', () => {
  it('discovers Next.js pages from pages/, app/, src/pages/, and src/app/', () => {
    expect(discoverNextJsPageEntries(nextjsFixtureDirectory)).toEqual([
      'app/dashboard/page.tsx',
      'pages/index.tsx',
      'src/app/settings/page.tsx',
      'src/pages/profile.tsx',
    ])
  })

  it('prefers the explicit entry file when --nextjs is also enabled', () => {
    expect(
      resolveReactEntryFiles({
        command: 'react',
        entryFile: 'pages/index.tsx',
        diff: undefined,
        cwd: nextjsFixtureDirectory,
        configPath: undefined,
        expandWorkspaces: true,
        projectOnly: false,
        json: false,
        filter: 'all',
        includeBuiltins: false,
        nextjs: true,
      }),
    ).toEqual(['pages/index.tsx'])
  })

  it('analyzes multiple discovered Next.js entries together', () => {
    const entryFiles = discoverNextJsPageEntries(nextjsFixtureDirectory)
    const graph = analyzeReactUsage(entryFiles, {
      cwd: nextjsFixtureDirectory,
    })

    const output = printReactUsageTree(graph, {
      color: false,
    })
    const jsonTree = graphToSerializableReactTree(graph)

    expect(graph.entryIds).toHaveLength(4)
    expect(output).toContain('app/dashboard/page.tsx:')
    expect(output).toContain('pages/index.tsx:')
    expect(output).toContain('src/app/settings/page.tsx:')
    expect(output).toContain('src/pages/profile.tsx:')
    expect(output).toContain(
      '<DashboardShell /> [component] (components/DashboardShell.tsx)',
    )
    expect(output).toContain('useSettings() [hook] (hooks/useSettings.ts)')
    expect(jsonTree).toMatchObject({
      entries: [
        expect.objectContaining({
          filePath: 'app/dashboard/page.tsx',
        }),
        expect.objectContaining({
          filePath: 'pages/index.tsx',
        }),
        expect.objectContaining({
          filePath: 'src/app/settings/page.tsx',
        }),
        expect.objectContaining({
          filePath: 'src/pages/profile.tsx',
        }),
      ],
    })
  })
})

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

describe('analyzeReactUsageDiff', () => {
  it('prints React tree changes for a Git range', () => {
    const repositoryRoot = createGitRepository([
      {
        message: 'initial',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'react-diff-fixture',
              private: true,
            },
            null,
            2,
          ),
          'tsconfig.json': JSON.stringify(
            {
              compilerOptions: {
                jsx: 'react-jsx',
              },
            },
            null,
            2,
          ),
          'src/main.tsx': [
            "import { AppShell } from './AppShell'",
            '',
            'void (<AppShell />)',
            '',
          ].join('\n'),
          'src/AppShell.tsx': [
            "import { Panel } from './components/Panel'",
            '',
            'export function AppShell() {',
            '  return <Panel />',
            '}',
            '',
          ].join('\n'),
          'src/components/Panel.tsx': [
            'export function Panel() {',
            '  return <section />',
            '}',
            '',
          ].join('\n'),
        },
      },
      {
        message: 'swap rendered component',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'react-diff-fixture',
              private: true,
            },
            null,
            2,
          ),
          'tsconfig.json': JSON.stringify(
            {
              compilerOptions: {
                jsx: 'react-jsx',
              },
            },
            null,
            2,
          ),
          'src/main.tsx': [
            "import { AppShell } from './AppShell'",
            '',
            'void (<AppShell />)',
            '',
          ].join('\n'),
          'src/AppShell.tsx': [
            "import { Button } from './components/Button'",
            '',
            'export function AppShell() {',
            '  return <Button />',
            '}',
            '',
          ].join('\n'),
          'src/components/Button.tsx': [
            'export function Button() {',
            '  return <button />',
            '}',
            '',
          ].join('\n'),
        },
      },
    ])

    const graph = analyzeReactUsageDiff({
      command: 'react',
      entryFile: 'src/main.tsx',
      diff: 'HEAD~1..HEAD',
      cwd: repositoryRoot,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: false,
      filter: 'component',
      nextjs: false,
      includeBuiltins: false,
    })
    const output = printReactUsageDiffTree(graph, {
      color: false,
    })
    const jsonTree = diffGraphToSerializableReactTree(graph)

    expect(output).toBe(
      [
        '~ src/main.tsx:3:7',
        '~ <AppShell /> [component] (src/AppShell.tsx)',
        '├─ + <Button /> [component] (src/components/Button.tsx)',
        '└─ - <Panel /> [component] (src/components/Panel.tsx)',
      ].join('\n'),
    )
    expect(jsonTree).toMatchObject({
      kind: 'react-usage-diff',
      entries: [
        expect.objectContaining({
          change: 'unchanged',
          afterFilePath: 'src/main.tsx',
          afterLine: 3,
          afterColumn: 7,
          node: expect.objectContaining({
            name: 'AppShell',
            change: 'changed',
            usages: expect.arrayContaining([
              expect.objectContaining({
                change: 'added',
                referenceName: 'Button',
                node: expect.objectContaining({
                  name: 'Button',
                  change: 'added',
                }),
              }),
              expect.objectContaining({
                change: 'removed',
                referenceName: 'Panel',
                node: expect.objectContaining({
                  name: 'Panel',
                  change: 'removed',
                }),
              }),
            ]),
          }),
        }),
      ],
    })
  })
})

function createGitRepository(
  commits: readonly {
    readonly message: string
    readonly files: Readonly<Record<string, string>>
  }[],
): string {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'foresthouse-react-git-fixture-'),
  )

  temporaryDirectories.push(repositoryRoot)

  runGit(repositoryRoot, ['init', '--initial-branch=main'])
  runGit(repositoryRoot, ['config', 'user.name', 'Foresthouse Tests'])
  runGit(repositoryRoot, ['config', 'user.email', 'tests@example.com'])

  commits.forEach((commit) => {
    replaceRepositoryFiles(repositoryRoot, commit.files)
    runGit(repositoryRoot, ['add', '-A'])
    runGit(repositoryRoot, ['commit', '-m', commit.message])
  })

  return repositoryRoot
}

function replaceRepositoryFiles(
  repositoryRoot: string,
  files: Readonly<Record<string, string>>,
): void {
  fs.readdirSync(repositoryRoot, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === '.git') {
      return
    }

    fs.rmSync(path.join(repositoryRoot, entry.name), {
      recursive: true,
      force: true,
    })
  })

  Object.entries(files).forEach(([relativePath, fileContent]) => {
    const absolutePath = path.join(repositoryRoot, relativePath)

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, fileContent)
  })
}

function runGit(repositoryRoot: string, args: readonly string[]): string {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: GIT_EXEC_MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}
