import { describe, expect, it } from 'vitest'

import type { ReactUsageGraph } from '../../types/react-usage-graph.js'
import {
  diffGraphToSerializableReactTree,
  graphToSerializableReactTree,
} from './react.js'

function createGraph(overrides?: Partial<ReactUsageGraph>): ReactUsageGraph {
  return {
    cwd: '/project',
    entryId: 'src/main.tsx',
    entryIds: ['src/main.tsx'],
    entries: [
      {
        target: 'src/App.tsx#component:App',
        referenceName: 'App',
        location: { filePath: '/project/src/main.tsx', line: 3, column: 1 },
      },
    ],
    nodes: new Map([
      [
        'src/App.tsx#component:App',
        {
          id: 'src/App.tsx#component:App',
          name: 'App',
          kind: 'component',
          filePath: '/project/src/App.tsx',
          exportNames: ['default'],
          usages: [
            {
              kind: 'hook-call',
              target: 'src/hooks.ts#hook:useData',
              referenceName: 'useData',
            },
          ],
        },
      ],
      [
        'src/hooks.ts#hook:useData',
        {
          id: 'src/hooks.ts#hook:useData',
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

describe('graphToSerializableReactTree', () => {
  it('serializes a graph with entries', () => {
    const graph = createGraph()
    const tree = graphToSerializableReactTree(graph) as Record<string, unknown>

    expect(tree.kind).toBe('react-usage')
    const entries = tree.entries as Record<string, unknown>[]
    expect(entries).toHaveLength(1)
    const entry0 = entries[0] as Record<string, unknown>
    expect(entry0.referenceName).toBe('App')
    expect(entry0.targetId).toBe('src/App.tsx#component:App')
  })

  it('serializes nested usages in nodes', () => {
    const graph = createGraph()
    const tree = graphToSerializableReactTree(graph) as Record<string, unknown>
    const roots = tree.roots as Record<string, unknown>[]
    const appNode = roots[0] as Record<string, unknown>

    expect(appNode.name).toBe('App')
    expect(appNode.symbolKind).toBe('component')
    const usages = appNode.usages as Record<string, unknown>[]
    expect(usages).toHaveLength(1)
    const usage0 = usages[0] as Record<string, unknown>
    expect(usage0.referenceName).toBe('useData')
  })

  it('handles circular references', () => {
    const graph = createGraph({
      entries: [],
      nodes: new Map([
        [
          'a',
          {
            id: 'a',
            name: 'CompA',
            kind: 'component',
            filePath: '/project/src/a.tsx',
            exportNames: [],
            usages: [{ kind: 'render', target: 'b', referenceName: 'CompB' }],
          },
        ],
        [
          'b',
          {
            id: 'b',
            name: 'CompB',
            kind: 'component',
            filePath: '/project/src/b.tsx',
            exportNames: [],
            usages: [{ kind: 'render', target: 'a', referenceName: 'CompA' }],
          },
        ],
      ]),
    })

    const tree = graphToSerializableReactTree(graph) as Record<string, unknown>
    const roots = tree.roots as Record<string, unknown>[]
    const root0 = roots[0] as Record<string, unknown>
    const usages = root0.usages as Record<string, unknown>[]
    const usage0 = usages[0] as Record<string, unknown>
    const nestedNode = usage0.node as Record<string, unknown>
    const nestedUsages = nestedNode.usages as Record<string, unknown>[]
    const nestedUsage0 = nestedUsages[0] as Record<string, unknown>
    const circularNode = nestedUsage0.node as Record<string, unknown>

    expect(circularNode.symbolKind).toBe('circular')
    expect(circularNode.usages).toEqual([])
  })

  it('filters by component kind', () => {
    const graph = createGraph()
    const tree = graphToSerializableReactTree(graph, {
      filter: 'component',
    }) as Record<string, unknown>

    const entries = tree.entries as Record<string, unknown>[]
    expect(entries).toHaveLength(1)

    const roots = tree.roots as Record<string, unknown>[]
    const appNode = roots[0] as Record<string, unknown>
    const usages = appNode.usages as Record<string, unknown>[]
    expect(usages).toHaveLength(0)
  })

  it('filters out usages pointing to non-existent nodes', () => {
    const graph = createGraph({
      entries: [
        {
          target: 'comp:App',
          referenceName: 'App',
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
            exportNames: [],
            usages: [
              { kind: 'render', target: 'missing', referenceName: 'Missing' },
            ],
          },
        ],
      ]),
    })

    const tree = graphToSerializableReactTree(graph) as Record<string, unknown>
    const roots = tree.roots as Record<string, unknown>[]
    const filterRoot = roots[0] as Record<string, unknown>
    const usages = filterRoot.usages as Record<string, unknown>[]
    expect(usages).toHaveLength(0)
  })
})

describe('diffGraphToSerializableReactTree', () => {
  it('serializes a diff graph', () => {
    const tree = diffGraphToSerializableReactTree({
      kind: 'react-usage-diff',
      repositoryRoot: '/repo',
      cwd: '/project',
      entries: [],
      roots: [
        {
          id: 'a',
          name: 'App',
          symbolKind: 'component',
          filePath: 'src/App.tsx',
          change: 'added',
          exportNames: ['default'],
          usages: [],
        },
      ],
    }) as Record<string, unknown>

    expect(tree.kind).toBe('react-usage-diff')
    const roots = tree.roots as Record<string, unknown>[]
    expect(roots).toHaveLength(1)
    const diffRoot = roots[0] as Record<string, unknown>
    expect(diffRoot.change).toBe('added')
  })

  it('serializes entries with before/after reference names and locations', () => {
    const tree = diffGraphToSerializableReactTree({
      kind: 'react-usage-diff',
      repositoryRoot: '/repo',
      cwd: '/project',
      entries: [
        {
          key: 'entry:App',
          change: 'changed',
          targetId: 'comp:App',
          referenceName: 'App',
          beforeReferenceName: 'OldApp',
          afterReferenceName: 'NewApp',
          beforeFilePath: 'src/old.tsx',
          beforeLine: 1,
          beforeColumn: 1,
          afterFilePath: 'src/new.tsx',
          afterLine: 5,
          afterColumn: 3,
          node: {
            id: 'comp:App',
            name: 'App',
            symbolKind: 'component',
            filePath: 'src/App.tsx',
            change: 'changed',
            exportNames: ['default'],
            beforeExportNames: ['default'],
            afterExportNames: ['default', 'App'],
            usages: [],
          },
        },
      ],
      roots: [],
    }) as Record<string, unknown>

    const entries = tree.entries as Record<string, unknown>[]
    const entry = entries[0] as Record<string, unknown>
    expect(entry.beforeReferenceName).toBe('OldApp')
    expect(entry.afterReferenceName).toBe('NewApp')
    expect(entry.beforeFilePath).toBe('src/old.tsx')
    expect(entry.afterFilePath).toBe('src/new.tsx')
    expect(entry.beforeLine).toBe(1)
    expect(entry.afterLine).toBe(5)

    const node = entry.node as Record<string, unknown>
    expect(node.beforeExportNames).toEqual(['default'])
    expect(node.afterExportNames).toEqual(['default', 'App'])
  })

  it('serializes edges with before/after reference names', () => {
    const tree = diffGraphToSerializableReactTree({
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
              change: 'changed',
              targetId: 'comp:B',
              referenceName: 'B',
              beforeReferenceName: 'OldB',
              afterReferenceName: 'NewB',
              node: {
                id: 'comp:B',
                name: 'B',
                symbolKind: 'component',
                filePath: 'src/b.tsx',
                change: 'unchanged',
                exportNames: [],
                usages: [],
              },
            },
          ],
        },
      ],
    }) as Record<string, unknown>

    const roots = tree.roots as Record<string, unknown>[]
    const root = roots[0] as Record<string, unknown>
    const usages = root.usages as Record<string, unknown>[]
    const usage = usages[0] as Record<string, unknown>
    expect(usage.beforeReferenceName).toBe('OldB')
    expect(usage.afterReferenceName).toBe('NewB')
    expect(usage.change).toBe('changed')
  })

  it('serializes circular diff nodes', () => {
    const tree = diffGraphToSerializableReactTree({
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
    }) as Record<string, unknown>

    const roots = tree.roots as Record<string, unknown>[]
    const root = roots[0] as Record<string, unknown>
    const usages = root.usages as Record<string, unknown>[]
    const usage = usages[0] as Record<string, unknown>
    const node = usage.node as Record<string, unknown>
    expect(node.circular).toBe(true)
  })
})
