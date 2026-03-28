import { describe, expect, it } from 'vitest'

import type { ReactUsageDiffGraph } from '../../types/react-usage-diff-graph.js'
import type { ReactUsageGraph } from '../../types/react-usage-graph.js'
import { printReactUsageDiffTree, printReactUsageTree } from './react.js'

function createGraph(overrides?: Partial<ReactUsageGraph>): ReactUsageGraph {
  return {
    cwd: '/project',
    entryId: 'src/main.tsx',
    entryIds: ['src/main.tsx'],
    entries: [
      {
        target: 'comp:App',
        referenceName: 'App',
        location: { filePath: '/project/src/main.tsx', line: 3, column: 1 },
      },
    ],
    nodes: new Map([
      [
        'comp:App',
        {
          id: 'comp:App',
          name: 'App',
          kind: 'component',
          filePath: '/project/src/App.tsx',
          exportNames: ['default'],
          usages: [
            {
              kind: 'hook-call',
              target: 'hook:useData',
              referenceName: 'useData',
            },
          ],
        },
      ],
      [
        'hook:useData',
        {
          id: 'hook:useData',
          name: 'useData',
          kind: 'hook',
          filePath: '/project/src/hooks.ts',
          exportNames: ['useData'],
          usages: [],
        },
      ],
    ]),
    ...overrides,
  }
}

describe('printReactUsageTree', () => {
  it('prints a tree with entries', () => {
    const graph = createGraph()
    const output = printReactUsageTree(graph, { color: false })

    expect(output).toContain('src/main.tsx:3:1')
    expect(output).toContain('<App /> [component]')
    expect(output).toContain('useData() [hook]')
  })

  it('prints no symbols message when graph is empty', () => {
    const graph = createGraph({
      entries: [],
      nodes: new Map(),
    })

    const output = printReactUsageTree(graph, { color: false })
    expect(output).toBe('No React symbols found.')
  })

  it('prints roots when no entries exist', () => {
    const graph = createGraph({
      entries: [],
      nodes: new Map([
        [
          'comp:App',
          {
            id: 'comp:App',
            name: 'App',
            kind: 'component',
            filePath: '/project/src/App.tsx',
            exportNames: ['default'],
            usages: [],
          },
        ],
      ]),
    })

    const output = printReactUsageTree(graph, { color: false })
    expect(output).toContain('<App /> [component]')
  })

  it('marks circular references', () => {
    const graph = createGraph({
      entries: [],
      nodes: new Map([
        [
          'comp:A',
          {
            id: 'comp:A',
            name: 'A',
            kind: 'component',
            filePath: '/project/src/a.tsx',
            exportNames: [],
            usages: [{ kind: 'render', target: 'comp:B', referenceName: 'B' }],
          },
        ],
        [
          'comp:B',
          {
            id: 'comp:B',
            name: 'B',
            kind: 'component',
            filePath: '/project/src/b.tsx',
            exportNames: [],
            usages: [{ kind: 'render', target: 'comp:A', referenceName: 'A' }],
          },
        ],
      ]),
    })

    const output = printReactUsageTree(graph, { color: false })
    expect(output).toContain('(circular)')
  })

  it('shows alias when reference name differs from symbol name', () => {
    const graph: ReactUsageGraph = {
      cwd: '/project',
      entryId: 'src/main.tsx',
      entryIds: ['src/main.tsx'],
      entries: [
        {
          target: 'comp:App',
          referenceName: 'MyApp',
          location: { filePath: '/project/src/main.tsx', line: 1, column: 1 },
        },
      ],
      nodes: new Map([
        [
          'comp:App',
          {
            id: 'comp:App',
            name: 'App',
            kind: 'component',
            filePath: '/project/src/App.tsx',
            exportNames: ['default'],
            usages: [],
          },
        ],
      ]),
    }

    const output = printReactUsageTree(graph, { color: false })
    expect(output).toContain('as MyApp')
  })

  it('filters by component kind', () => {
    const graph = createGraph()
    const output = printReactUsageTree(graph, {
      color: false,
      filter: 'component',
    })

    expect(output).toContain('<App /> [component]')
    expect(output).not.toContain('useData')
  })

  it('shows builtin file path as html', () => {
    const graph: ReactUsageGraph = {
      cwd: '/project',
      entryId: 'src/main.tsx',
      entryIds: ['src/main.tsx'],
      entries: [],
      nodes: new Map([
        [
          'builtin:div',
          {
            id: 'builtin:div',
            name: 'div',
            kind: 'builtin',
            filePath: 'html',
            exportNames: [],
            usages: [],
          },
        ],
      ]),
    }

    const output = printReactUsageTree(graph, {
      color: false,
      filter: 'builtin',
    })
    expect(output).toContain('(html)')
  })
})

describe('printReactUsageDiffTree', () => {
  it('prints no changes message when graph is empty', () => {
    const graph: ReactUsageDiffGraph = {
      kind: 'react-usage-diff',
      repositoryRoot: '/repo',
      cwd: '/project',
      entries: [],
      roots: [],
    }

    const output = printReactUsageDiffTree(graph, { color: false })
    expect(output).toBe('No React changes found.')
  })

  it('prints diff entries with change markers', () => {
    const graph: ReactUsageDiffGraph = {
      kind: 'react-usage-diff',
      repositoryRoot: '/repo',
      cwd: '/project',
      entries: [
        {
          key: 'entry:App',
          change: 'added',
          targetId: 'comp:App',
          referenceName: 'App',
          afterFilePath: 'src/main.tsx',
          afterLine: 3,
          afterColumn: 1,
          node: {
            id: 'comp:App',
            name: 'App',
            symbolKind: 'component',
            filePath: 'src/App.tsx',
            change: 'added',
            exportNames: ['default'],
            usages: [],
          },
        },
      ],
      roots: [],
    }

    const output = printReactUsageDiffTree(graph, { color: false })
    expect(output).toContain('+ ')
  })

  it('prints diff roots when no entries', () => {
    const graph: ReactUsageDiffGraph = {
      kind: 'react-usage-diff',
      repositoryRoot: '/repo',
      cwd: '/project',
      entries: [],
      roots: [
        {
          id: 'comp:App',
          name: 'App',
          symbolKind: 'component',
          filePath: 'src/App.tsx',
          change: 'removed',
          exportNames: ['default'],
          usages: [],
        },
      ],
    }

    const output = printReactUsageDiffTree(graph, { color: false })
    expect(output).toContain('- ')
    expect(output).toContain('App')
  })

  it('marks circular diff nodes', () => {
    const graph: ReactUsageDiffGraph = {
      kind: 'react-usage-diff',
      repositoryRoot: '/repo',
      cwd: '/project',
      entries: [],
      roots: [
        {
          id: 'comp:A',
          name: 'A',
          symbolKind: 'component',
          filePath: 'src/a.tsx',
          change: 'unchanged',
          exportNames: [],
          usages: [
            {
              key: 'edge:B',
              kind: 'render',
              change: 'unchanged',
              targetId: 'comp:B',
              referenceName: 'B',
              node: {
                id: 'comp:B',
                name: 'B',
                symbolKind: 'component',
                circular: true,
                filePath: 'src/b.tsx',
                change: 'unchanged',
                exportNames: [],
                usages: [],
              },
            },
          ],
        },
      ],
    }

    const output = printReactUsageDiffTree(graph, { color: false })
    expect(output).toContain('(circular)')
  })
})
