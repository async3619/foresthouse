import { describe, expect, it } from 'vitest'

import type { ReactUsageNode } from '../../types/react-usage-node.js'
import type { ImportBinding } from './bindings.js'
import type { FileAnalysis, PendingReactUsageNode } from './file.js'
import {
  addBuiltinNodes,
  addExternalHookNodes,
  compareReactNodeIds,
  compareReactUsageEntries,
  getBuiltinNodeId,
  resolveReactReference,
} from './references.js'

function createFileAnalysis(overrides?: Partial<FileAnalysis>): FileAnalysis {
  return {
    filePath: '/test.tsx',
    importsByLocalName: new Map(),
    exportsByName: new Map(),
    reExportBindingsByName: new Map(),
    exportAllBindings: [],
    entryUsages: [],
    allSymbolsById: new Map(),
    allSymbolsByName: new Map(),
    symbolsById: new Map(),
    symbolsByName: new Map(),
    ...overrides,
  }
}

function createPendingSymbol(
  name: string,
  kind: 'component' | 'hook',
  filePath = '/test.tsx',
): PendingReactUsageNode {
  return {
    id: `${filePath}#${kind}:${name}`,
    name,
    kind,
    filePath,
    declarationOffset: 0,
    analysisRoot: { type: 'FunctionBody' } as never,
    exportNames: new Set(),
    componentReferences: new Set(),
    hookReferences: new Set(),
    builtinReferences: new Set(),
  }
}

describe('getBuiltinNodeId', () => {
  it('returns builtin: prefixed id', () => {
    expect(getBuiltinNodeId('div')).toBe('builtin:div')
    expect(getBuiltinNodeId('span')).toBe('builtin:span')
  })
})

describe('resolveReactReference', () => {
  it('resolves builtin references', () => {
    const fileAnalysis = createFileAnalysis()
    const result = resolveReactReference(
      fileAnalysis,
      new Map(),
      'div',
      'builtin',
    )
    expect(result).toBe('builtin:div')
  })

  it('resolves local symbol by name and kind', () => {
    const symbol = createPendingSymbol('App', 'component')
    const fileAnalysis = createFileAnalysis({
      allSymbolsByName: new Map([['App', symbol]]),
    })

    const result = resolveReactReference(
      fileAnalysis,
      new Map(),
      'App',
      'component',
    )
    expect(result).toBe('/test.tsx#component:App')
  })

  it('returns undefined when local symbol kind does not match', () => {
    const symbol = createPendingSymbol('App', 'component')
    const fileAnalysis = createFileAnalysis({
      allSymbolsByName: new Map([['App', symbol]]),
    })

    const result = resolveReactReference(fileAnalysis, new Map(), 'App', 'hook')
    expect(result).toBeUndefined()
  })

  it('resolves imported symbol through source file analysis', () => {
    const targetSymbol = createPendingSymbol(
      'Button',
      'component',
      '/src/button.tsx',
    )
    targetSymbol.exportNames.add('Button')

    const sourceAnalysis = createFileAnalysis({
      filePath: '/src/button.tsx',
      exportsByName: new Map([['Button', '/src/button.tsx#component:Button']]),
      allSymbolsById: new Map([
        ['/src/button.tsx#component:Button', targetSymbol],
      ]),
    })

    const fileAnalysis = createFileAnalysis({
      importsByLocalName: new Map([
        [
          'Button',
          {
            importedName: 'Button',
            sourceSpecifier: './button',
            sourcePath: '/src/button.tsx',
          },
        ],
      ]),
    })

    const result = resolveReactReference(
      fileAnalysis,
      new Map([['/src/button.tsx', sourceAnalysis]]),
      'Button',
      'component',
    )
    expect(result).toBe('/src/button.tsx#component:Button')
  })

  it('returns external hook ID for unresolved hook import', () => {
    const fileAnalysis = createFileAnalysis({
      importsByLocalName: new Map([
        [
          'useQuery',
          {
            importedName: 'useQuery',
            sourceSpecifier: '@tanstack/react-query',
          },
        ],
      ]),
    })

    const result = resolveReactReference(
      fileAnalysis,
      new Map(),
      'useQuery',
      'hook',
    )
    expect(result).toBe('external:@tanstack/react-query#hook:useQuery')
  })

  it('returns undefined for unresolved non-hook import', () => {
    const fileAnalysis = createFileAnalysis({
      importsByLocalName: new Map([
        [
          'Button',
          {
            importedName: 'Button',
            sourceSpecifier: 'some-lib',
          },
        ],
      ]),
    })

    const result = resolveReactReference(
      fileAnalysis,
      new Map(),
      'Button',
      'component',
    )
    expect(result).toBeUndefined()
  })

  it('resolves re-export chain', () => {
    const targetSymbol = createPendingSymbol('App', 'component', '/deep.tsx')
    targetSymbol.exportNames.add('App')

    const deepAnalysis = createFileAnalysis({
      filePath: '/deep.tsx',
      exportsByName: new Map([['App', '/deep.tsx#component:App']]),
      allSymbolsById: new Map([['/deep.tsx#component:App', targetSymbol]]),
    })

    const middleAnalysis = createFileAnalysis({
      filePath: '/middle.tsx',
      reExportBindingsByName: new Map([
        [
          'App',
          {
            importedName: 'App',
            sourceSpecifier: './deep',
            sourcePath: '/deep.tsx',
          },
        ],
      ]),
    })

    const fileAnalysis = createFileAnalysis({
      importsByLocalName: new Map([
        [
          'App',
          {
            importedName: 'App',
            sourceSpecifier: './middle',
            sourcePath: '/middle.tsx',
          },
        ],
      ]),
    })

    const fileAnalyses = new Map([
      ['/middle.tsx', middleAnalysis],
      ['/deep.tsx', deepAnalysis],
    ])

    const result = resolveReactReference(
      fileAnalysis,
      fileAnalyses,
      'App',
      'component',
    )
    expect(result).toBe('/deep.tsx#component:App')
  })

  it('resolves through export all bindings', () => {
    const targetSymbol = createPendingSymbol('App', 'component', '/deep.tsx')
    targetSymbol.exportNames.add('App')

    const deepAnalysis = createFileAnalysis({
      filePath: '/deep.tsx',
      exportsByName: new Map([['App', '/deep.tsx#component:App']]),
      allSymbolsById: new Map([['/deep.tsx#component:App', targetSymbol]]),
    })

    const middleAnalysis = createFileAnalysis({
      filePath: '/middle.tsx',
      exportAllBindings: [
        {
          importedName: '*',
          sourceSpecifier: './deep',
          sourcePath: '/deep.tsx',
        },
      ],
    })

    const fileAnalysis = createFileAnalysis({
      importsByLocalName: new Map([
        [
          'App',
          {
            importedName: 'App',
            sourceSpecifier: './middle',
            sourcePath: '/middle.tsx',
          },
        ],
      ]),
    })

    const result = resolveReactReference(
      fileAnalysis,
      new Map([
        ['/middle.tsx', middleAnalysis],
        ['/deep.tsx', deepAnalysis],
      ]),
      'App',
      'component',
    )
    expect(result).toBe('/deep.tsx#component:App')
  })

  it('resolves namespace member references', () => {
    const targetSymbol = createPendingSymbol('Item', 'component', '/ns.tsx')
    targetSymbol.exportNames.add('Item')

    const nsAnalysis = createFileAnalysis({
      filePath: '/ns.tsx',
      exportsByName: new Map([['Item', '/ns.tsx#component:Item']]),
      allSymbolsById: new Map([['/ns.tsx#component:Item', targetSymbol]]),
    })

    const fileAnalysis = createFileAnalysis({
      importsByLocalName: new Map([
        [
          'Ns',
          {
            importedName: '*',
            sourceSpecifier: './ns',
            sourcePath: '/ns.tsx',
          },
        ],
      ]),
    })

    const result = resolveReactReference(
      fileAnalysis,
      new Map([['/ns.tsx', nsAnalysis]]),
      'Ns.Item',
      'component',
    )
    expect(result).toBe('/ns.tsx#component:Item')
  })

  it('returns undefined for namespace member without * import', () => {
    const fileAnalysis = createFileAnalysis({
      importsByLocalName: new Map([
        [
          'Ns',
          {
            importedName: 'default',
            sourceSpecifier: './ns',
            sourcePath: '/ns.tsx',
          },
        ],
      ]),
    })

    const result = resolveReactReference(
      fileAnalysis,
      new Map(),
      'Ns.Item',
      'component',
    )
    expect(result).toBeUndefined()
  })
})

describe('addExternalHookNodes', () => {
  it('creates nodes for imported hooks without sourcePath', () => {
    const fileAnalyses = new Map([
      [
        '/test.tsx',
        createFileAnalysis({
          importsByLocalName: new Map<string, ImportBinding>([
            [
              'useQuery',
              {
                importedName: 'useQuery',
                sourceSpecifier: '@tanstack/react-query',
              },
            ],
          ]),
        }),
      ],
    ])

    const nodes = new Map<string, ReactUsageNode>()
    addExternalHookNodes(fileAnalyses, nodes)

    expect(nodes.size).toBe(1)
    const node = [...nodes.values()][0]
    expect(node.kind).toBe('hook')
    expect(node.name).toBe('useQuery')
    expect(node.filePath).toBe('@tanstack/react-query')
  })

  it('uses local name when imported as default', () => {
    const fileAnalyses = new Map([
      [
        '/test.tsx',
        createFileAnalysis({
          importsByLocalName: new Map<string, ImportBinding>([
            [
              'useCustomHook',
              {
                importedName: 'default',
                sourceSpecifier: 'some-lib',
              },
            ],
          ]),
        }),
      ],
    ])

    const nodes = new Map<string, ReactUsageNode>()
    addExternalHookNodes(fileAnalyses, nodes)

    const node = [...nodes.values()][0]
    expect(node.name).toBe('useCustomHook')
  })

  it('skips non-hook imports', () => {
    const fileAnalyses = new Map([
      [
        '/test.tsx',
        createFileAnalysis({
          importsByLocalName: new Map<string, ImportBinding>([
            [
              'Button',
              {
                importedName: 'Button',
                sourceSpecifier: 'some-lib',
              },
            ],
          ]),
        }),
      ],
    ])

    const nodes = new Map<string, ReactUsageNode>()
    addExternalHookNodes(fileAnalyses, nodes)

    expect(nodes.size).toBe(0)
  })

  it('skips imports with sourcePath', () => {
    const fileAnalyses = new Map([
      [
        '/test.tsx',
        createFileAnalysis({
          importsByLocalName: new Map<string, ImportBinding>([
            [
              'useData',
              {
                importedName: 'useData',
                sourceSpecifier: './hooks',
                sourcePath: '/src/hooks.ts',
              },
            ],
          ]),
        }),
      ],
    ])

    const nodes = new Map<string, ReactUsageNode>()
    addExternalHookNodes(fileAnalyses, nodes)

    expect(nodes.size).toBe(0)
  })
})

describe('addBuiltinNodes', () => {
  it('creates nodes from entry usages with builtin kind', () => {
    const fileAnalyses = new Map([
      [
        '/test.tsx',
        createFileAnalysis({
          entryUsages: [
            {
              referenceName: 'div',
              kind: 'builtin',
              location: { filePath: '/test.tsx', line: 1, column: 1 },
            },
          ],
        }),
      ],
    ])

    const nodes = new Map<string, ReactUsageNode>()
    addBuiltinNodes(fileAnalyses, nodes)

    expect(nodes.has('builtin:div')).toBe(true)
    expect(nodes.get('builtin:div')?.kind).toBe('builtin')
    expect(nodes.get('builtin:div')?.filePath).toBe('html')
  })

  it('creates nodes from symbol builtin references', () => {
    const symbol = createPendingSymbol('App', 'component')
    symbol.builtinReferences.add('span')

    const fileAnalyses = new Map([
      [
        '/test.tsx',
        createFileAnalysis({
          allSymbolsById: new Map([[symbol.id, symbol]]),
        }),
      ],
    ])

    const nodes = new Map<string, ReactUsageNode>()
    addBuiltinNodes(fileAnalyses, nodes)

    expect(nodes.has('builtin:span')).toBe(true)
  })

  it('does not duplicate existing builtin nodes', () => {
    const symbol = createPendingSymbol('App', 'component')
    symbol.builtinReferences.add('div')

    const fileAnalyses = new Map([
      [
        '/test.tsx',
        createFileAnalysis({
          entryUsages: [
            {
              referenceName: 'div',
              kind: 'builtin',
              location: { filePath: '/test.tsx', line: 1, column: 1 },
            },
          ],
          allSymbolsById: new Map([[symbol.id, symbol]]),
        }),
      ],
    ])

    const nodes = new Map<string, ReactUsageNode>()
    addBuiltinNodes(fileAnalyses, nodes)

    expect(nodes.size).toBe(1)
  })
})

describe('compareReactNodeIds', () => {
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

  it('compares by node properties', () => {
    expect(compareReactNodeIds('a', 'b', nodes)).toBeLessThan(0)
    expect(compareReactNodeIds('b', 'a', nodes)).toBeGreaterThan(0)
    expect(compareReactNodeIds('a', 'a', nodes)).toBe(0)
  })

  it('falls back to string comparison for missing nodes', () => {
    expect(compareReactNodeIds('x', 'y', nodes)).toBeLessThan(0)
    expect(compareReactNodeIds('y', 'x', nodes)).toBeGreaterThan(0)
  })
})

describe('compareReactUsageEntries', () => {
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
  ])

  it('compares by file path first', () => {
    const result = compareReactUsageEntries(
      {
        target: 'a',
        referenceName: 'App',
        location: { filePath: 'a.tsx', line: 1, column: 1 },
      },
      {
        target: 'a',
        referenceName: 'App',
        location: { filePath: 'b.tsx', line: 1, column: 1 },
      },
      nodes,
    )
    expect(result).toBeLessThan(0)
  })

  it('compares by line when file paths match', () => {
    const result = compareReactUsageEntries(
      {
        target: 'a',
        referenceName: 'App',
        location: { filePath: 'a.tsx', line: 1, column: 1 },
      },
      {
        target: 'a',
        referenceName: 'App',
        location: { filePath: 'a.tsx', line: 5, column: 1 },
      },
      nodes,
    )
    expect(result).toBeLessThan(0)
  })
})
