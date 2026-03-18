import { describe, expect, it } from 'vitest'

import type { ReactUsageGraph } from '../../types/react-usage-graph.js'
import {
  getFilteredUsages,
  getReactUsageEntries,
  getReactUsageRoots,
} from './queries.js'

const graph: ReactUsageGraph = {
  cwd: '/repo',
  entryId: 'src/main.tsx',
  entryIds: ['src/main.tsx'],
  entries: [
    {
      target: 'component:App',
      referenceName: 'App',
      location: { filePath: 'src/main.tsx', line: 1, column: 1 },
    },
  ],
  nodes: new Map([
    [
      'component:App',
      {
        id: 'component:App',
        name: 'App',
        kind: 'component',
        filePath: 'src/App.tsx',
        exportNames: ['default'],
        usages: [
          {
            kind: 'hook-call',
            target: 'hook:useFeature',
            referenceName: 'useFeature',
          },
        ],
      },
    ],
    [
      'hook:useFeature',
      {
        id: 'hook:useFeature',
        name: 'useFeature',
        kind: 'hook',
        filePath: 'src/hooks/useFeature.ts',
        exportNames: ['useFeature'],
        usages: [],
      },
    ],
  ]),
}

describe('react graph queries', () => {
  it('filters entries, roots, and usages by symbol kind', () => {
    const appNode = graph.nodes.get('component:App')

    expect(getReactUsageEntries(graph, 'component')).toHaveLength(1)
    expect(getReactUsageRoots(graph, 'hook')).toEqual(['hook:useFeature'])
    expect(appNode).toBeDefined()
    if (appNode === undefined) {
      return
    }
    expect(getFilteredUsages(appNode, graph, 'hook')).toHaveLength(1)
  })
})
