import { describe, expect, it } from 'vitest'

import type { ReactUsageGraph } from '../../types/react-usage-graph.js'
import type { ReactUsageNode } from '../../types/react-usage-node.js'
import {
  getFilteredUsages,
  getReactUsageEntries,
  getReactUsageRoots,
} from './queries.js'

function createGraph(overrides?: Partial<ReactUsageGraph>): ReactUsageGraph {
  return {
    cwd: '/repo',
    entryId: 'src/main.tsx',
    entryIds: ['src/main.tsx'],
    entries: [],
    nodes: new Map(),
    ...overrides,
  }
}

describe('getReactUsageEntries', () => {
  it('returns all entries with all filter', () => {
    const graph = createGraph({
      entries: [
        {
          target: 'comp:App',
          referenceName: 'App',
          location: { filePath: 'src/main.tsx', line: 1, column: 1 },
        },
      ],
      nodes: new Map([
        [
          'comp:App',
          {
            id: 'comp:App',
            name: 'App',
            kind: 'component',
            filePath: 'src/App.tsx',
            exportNames: [],
            usages: [],
          },
        ],
      ]),
    })

    expect(getReactUsageEntries(graph, 'all')).toHaveLength(1)
  })

  it('filters entries by component kind', () => {
    const graph = createGraph({
      entries: [
        {
          target: 'comp:App',
          referenceName: 'App',
          location: { filePath: 'src/main.tsx', line: 1, column: 1 },
        },
        {
          target: 'hook:useData',
          referenceName: 'useData',
          location: { filePath: 'src/main.tsx', line: 2, column: 1 },
        },
      ],
      nodes: new Map([
        [
          'comp:App',
          {
            id: 'comp:App',
            name: 'App',
            kind: 'component',
            filePath: 'src/App.tsx',
            exportNames: [],
            usages: [],
          },
        ],
        [
          'hook:useData',
          {
            id: 'hook:useData',
            name: 'useData',
            kind: 'hook',
            filePath: 'src/hooks.ts',
            exportNames: [],
            usages: [],
          },
        ],
      ]),
    })

    expect(getReactUsageEntries(graph, 'component')).toHaveLength(1)
    expect(getReactUsageEntries(graph, 'hook')).toHaveLength(1)
  })

  it('filters out entries whose target node does not exist', () => {
    const graph = createGraph({
      entries: [
        {
          target: 'missing',
          referenceName: 'Missing',
          location: { filePath: 'src/main.tsx', line: 1, column: 1 },
        },
      ],
    })

    expect(getReactUsageEntries(graph)).toHaveLength(0)
  })
})

describe('getReactUsageRoots', () => {
  it('returns entry targets when entries exist', () => {
    const graph = createGraph({
      entries: [
        {
          target: 'comp:App',
          referenceName: 'App',
          location: { filePath: 'src/main.tsx', line: 1, column: 1 },
        },
      ],
      nodes: new Map([
        [
          'comp:App',
          {
            id: 'comp:App',
            name: 'App',
            kind: 'component',
            filePath: 'src/App.tsx',
            exportNames: [],
            usages: [],
          },
        ],
      ]),
    })

    expect(getReactUsageRoots(graph)).toEqual(['comp:App'])
  })

  it('deduplicates entry targets', () => {
    const graph = createGraph({
      entries: [
        {
          target: 'comp:App',
          referenceName: 'App',
          location: { filePath: 'src/a.tsx', line: 1, column: 1 },
        },
        {
          target: 'comp:App',
          referenceName: 'App',
          location: { filePath: 'src/b.tsx', line: 1, column: 1 },
        },
      ],
      nodes: new Map([
        [
          'comp:App',
          {
            id: 'comp:App',
            name: 'App',
            kind: 'component',
            filePath: 'src/App.tsx',
            exportNames: [],
            usages: [],
          },
        ],
      ]),
    })

    expect(getReactUsageRoots(graph)).toEqual(['comp:App'])
  })

  it('finds zero-inbound nodes when no entries', () => {
    const graph = createGraph({
      nodes: new Map<string, ReactUsageNode>([
        [
          'comp:A',
          {
            id: 'comp:A',
            name: 'A',
            kind: 'component',
            filePath: 'src/a.tsx',
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
            filePath: 'src/b.tsx',
            exportNames: [],
            usages: [],
          },
        ],
      ]),
    })

    expect(getReactUsageRoots(graph)).toEqual(['comp:A'])
  })

  it('returns all nodes sorted when all have inbound references (cycle)', () => {
    const graph = createGraph({
      nodes: new Map<string, ReactUsageNode>([
        [
          'comp:A',
          {
            id: 'comp:A',
            name: 'A',
            kind: 'component',
            filePath: 'src/a.tsx',
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
            filePath: 'src/b.tsx',
            exportNames: [],
            usages: [{ kind: 'render', target: 'comp:A', referenceName: 'A' }],
          },
        ],
      ]),
    })

    const roots = getReactUsageRoots(graph)
    expect(roots).toHaveLength(2)
    expect(roots).toContain('comp:A')
    expect(roots).toContain('comp:B')
  })

  it('filters roots by kind', () => {
    const graph = createGraph({
      nodes: new Map<string, ReactUsageNode>([
        [
          'comp:A',
          {
            id: 'comp:A',
            name: 'A',
            kind: 'component',
            filePath: 'src/a.tsx',
            exportNames: [],
            usages: [],
          },
        ],
        [
          'hook:useData',
          {
            id: 'hook:useData',
            name: 'useData',
            kind: 'hook',
            filePath: 'src/hooks.ts',
            exportNames: [],
            usages: [],
          },
        ],
      ]),
    })

    expect(getReactUsageRoots(graph, 'component')).toEqual(['comp:A'])
    expect(getReactUsageRoots(graph, 'hook')).toEqual(['hook:useData'])
  })
})

describe('getFilteredUsages', () => {
  it('returns all usages with all filter', () => {
    const node: ReactUsageNode = {
      id: 'comp:A',
      name: 'A',
      kind: 'component',
      filePath: 'src/a.tsx',
      exportNames: [],
      usages: [
        { kind: 'render', target: 'comp:B', referenceName: 'B' },
        { kind: 'hook-call', target: 'hook:useData', referenceName: 'useData' },
      ],
    }

    const graph = createGraph({
      nodes: new Map<string, ReactUsageNode>([
        [node.id, node],
        [
          'comp:B',
          {
            id: 'comp:B',
            name: 'B',
            kind: 'component',
            filePath: 'src/b.tsx',
            exportNames: [],
            usages: [],
          },
        ],
        [
          'hook:useData',
          {
            id: 'hook:useData',
            name: 'useData',
            kind: 'hook',
            filePath: 'src/hooks.ts',
            exportNames: [],
            usages: [],
          },
        ],
      ]),
    })

    expect(getFilteredUsages(node, graph, 'all')).toHaveLength(2)
  })

  it('filters usages by target node kind', () => {
    const node: ReactUsageNode = {
      id: 'comp:A',
      name: 'A',
      kind: 'component',
      filePath: 'src/a.tsx',
      exportNames: [],
      usages: [
        { kind: 'render', target: 'comp:B', referenceName: 'B' },
        { kind: 'hook-call', target: 'hook:useData', referenceName: 'useData' },
      ],
    }

    const graph = createGraph({
      nodes: new Map<string, ReactUsageNode>([
        [node.id, node],
        [
          'comp:B',
          {
            id: 'comp:B',
            name: 'B',
            kind: 'component',
            filePath: 'src/b.tsx',
            exportNames: [],
            usages: [],
          },
        ],
        [
          'hook:useData',
          {
            id: 'hook:useData',
            name: 'useData',
            kind: 'hook',
            filePath: 'src/hooks.ts',
            exportNames: [],
            usages: [],
          },
        ],
      ]),
    })

    expect(getFilteredUsages(node, graph, 'component')).toHaveLength(1)
    expect(getFilteredUsages(node, graph, 'hook')).toHaveLength(1)
  })

  it('filters out usages with missing target nodes', () => {
    const node: ReactUsageNode = {
      id: 'comp:A',
      name: 'A',
      kind: 'component',
      filePath: 'src/a.tsx',
      exportNames: [],
      usages: [{ kind: 'render', target: 'missing', referenceName: 'Missing' }],
    }

    const graph = createGraph({
      nodes: new Map([[node.id, node]]),
    })

    expect(getFilteredUsages(node, graph)).toHaveLength(0)
  })
})
