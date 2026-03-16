import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  discoverNextJsPageEntries,
  resolveReactEntryFiles,
} from '../src/app/react-entry-files.js'
import {
  analyzeReactUsage,
  graphToSerializableReactTree,
  printReactUsageTree,
} from '../src/index.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const nextjsFixtureDirectory = path.join(
  currentDirectory,
  'fixtures',
  'nextjs-mode',
)
const reactFixtureDirectory = path.join(
  currentDirectory,
  'fixtures',
  'react-mode',
)

describe('Next.js React entry discovery', () => {
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
        cwd: nextjsFixtureDirectory,
        configPath: undefined,
        expandWorkspaces: true,
        projectOnly: false,
        json: false,
        filter: 'all',
        nextjs: true,
      }),
    ).toEqual(['pages/index.tsx'])
  })

  it('reports a clear error when no Next.js pages are found', () => {
    expect(() => discoverNextJsPageEntries(reactFixtureDirectory)).toThrow(
      /No Next\.js page entries found\./,
    )
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
