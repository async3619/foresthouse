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
    expect(entries[0].referenceName).toBe('App')
    expect(entries[0].targetId).toBe('src/App.tsx#component:App')
  })

  it('serializes nested usages in nodes', () => {
    const graph = createGraph()
    const tree = graphToSerializableReactTree(graph) as Record<string, unknown>
    const roots = tree.roots as Record<string, unknown>[]
    const appNode = roots[0]

    expect(appNode.name).toBe('App')
    expect(appNode.symbolKind).toBe('component')
    const usages = appNode.usages as Record<string, unknown>[]
    expect(usages).toHaveLength(1)
    expect(usages[0].referenceName).toBe('useData')
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
    const usages = roots[0].usages as Record<string, unknown>[]
    const nestedNode = usages[0].node as Record<string, unknown>
    const nestedUsages = nestedNode.usages as Record<string, unknown>[]
    const circularNode = nestedUsages[0].node as Record<string, unknown>

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
    const appNode = roots[0]
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
    const usages = roots[0].usages as Record<string, unknown>[]
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
    expect(roots[0].change).toBe('added')
  })
})
