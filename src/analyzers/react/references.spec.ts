import { describe, expect, it } from 'vitest'

import type { ReactUsageNode } from '../../types/react-usage-node.js'
import {
  compareReactNodeIds,
  compareReactUsageEntries,
  getBuiltinNodeId,
} from './references.js'

describe('react references helpers', () => {
  it('exports stable builtin ids and ordering helpers', () => {
    const nodes = new Map<string, ReactUsageNode>([
      [
        'a',
        {
          id: 'a',
          name: 'App',
          kind: 'component',
          filePath: 'src/App.tsx',
          exportNames: [],
          usages: [],
        },
      ],
      [
        'b',
        {
          id: 'b',
          name: 'Button',
          kind: 'component',
          filePath: 'src/Button.tsx',
          exportNames: [],
          usages: [],
        },
      ],
    ])

    expect(getBuiltinNodeId('button')).toBe('builtin:button')
    expect(compareReactNodeIds('a', 'b', nodes)).toBeLessThan(0)
    expect(
      compareReactUsageEntries(
        {
          target: 'a',
          referenceName: 'App',
          location: { filePath: 'a', line: 1, column: 1 },
        },
        {
          target: 'b',
          referenceName: 'Button',
          location: { filePath: 'b', line: 1, column: 1 },
        },
        nodes,
      ),
    ).toBeLessThan(0)
  })
})
