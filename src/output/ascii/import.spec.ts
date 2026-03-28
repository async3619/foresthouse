import { describe, expect, it } from 'vitest'

import type { DependencyGraph } from '../../types/dependency-graph.js'
import { printDependencyTree } from './import.js'

function createGraph(overrides?: Partial<DependencyGraph>): DependencyGraph {
  return {
    cwd: '/project',
    entryId: '/project/src/index.ts',
    nodes: new Map([
      [
        '/project/src/index.ts',
        {
          id: '/project/src/index.ts',
          dependencies: [
            {
              specifier: './utils',
              referenceKind: 'import' as const,
              isTypeOnly: false,
              unused: false,
              kind: 'source' as const,
              target: '/project/src/utils.ts',
            },
          ],
        },
      ],
      [
        '/project/src/utils.ts',
        {
          id: '/project/src/utils.ts',
          dependencies: [],
        },
      ],
    ]),
    ...overrides,
  }
}

describe('printDependencyTree', () => {
  it('prints a simple dependency tree', () => {
    const graph = createGraph()
    const output = printDependencyTree(graph, { color: false })

    expect(output).toBe('src/index.ts\n└─ src/utils.ts')
  })

  it('prints entry node when no dependencies found', () => {
    const graph: DependencyGraph = {
      cwd: '/project',
      entryId: '/project/src/index.ts',
      nodes: new Map(),
    }

    const output = printDependencyTree(graph, { color: false })
    expect(output).toBe('src/index.ts')
  })

  it('marks circular dependencies', () => {
    const graph: DependencyGraph = {
      cwd: '/project',
      entryId: '/project/a.ts',
      nodes: new Map([
        [
          '/project/a.ts',
          {
            id: '/project/a.ts',
            dependencies: [
              {
                specifier: './b',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'source' as const,
                target: '/project/b.ts',
              },
            ],
          },
        ],
        [
          '/project/b.ts',
          {
            id: '/project/b.ts',
            dependencies: [
              {
                specifier: './a',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'source' as const,
                target: '/project/a.ts',
              },
            ],
          },
        ],
      ]),
    }

    const output = printDependencyTree(graph, { color: false })
    expect(output).toContain('(circular)')
  })

  it('marks shared dependencies', () => {
    const graph: DependencyGraph = {
      cwd: '/project',
      entryId: '/project/a.ts',
      nodes: new Map([
        [
          '/project/a.ts',
          {
            id: '/project/a.ts',
            dependencies: [
              {
                specifier: './b',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'source' as const,
                target: '/project/b.ts',
              },
              {
                specifier: './c',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'source' as const,
                target: '/project/c.ts',
              },
            ],
          },
        ],
        [
          '/project/b.ts',
          {
            id: '/project/b.ts',
            dependencies: [
              {
                specifier: './c',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'source' as const,
                target: '/project/c.ts',
              },
            ],
          },
        ],
        ['/project/c.ts', { id: '/project/c.ts', dependencies: [] }],
      ]),
    }

    const output = printDependencyTree(graph, { color: false })
    expect(output).toContain('(shared)')
  })

  it('includes external dependencies when requested', () => {
    const graph: DependencyGraph = {
      cwd: '/project',
      entryId: '/project/a.ts',
      nodes: new Map([
        [
          '/project/a.ts',
          {
            id: '/project/a.ts',
            dependencies: [
              {
                specifier: 'react',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'external' as const,
                target: 'react',
              },
            ],
          },
        ],
      ]),
    }

    const withExternals = printDependencyTree(graph, {
      color: false,
      includeExternals: true,
    })
    expect(withExternals).toContain('react [external]')

    const withoutExternals = printDependencyTree(graph, {
      color: false,
      includeExternals: false,
    })
    expect(withoutExternals).toBe('a.ts')
  })

  it('annotates unused dependencies', () => {
    const graph: DependencyGraph = {
      cwd: '/project',
      entryId: '/project/a.ts',
      nodes: new Map([
        [
          '/project/a.ts',
          {
            id: '/project/a.ts',
            dependencies: [
              {
                specifier: './b',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: true,
                kind: 'source' as const,
                target: '/project/b.ts',
              },
            ],
          },
        ],
        ['/project/b.ts', { id: '/project/b.ts', dependencies: [] }],
      ]),
    }

    const output = printDependencyTree(graph, { color: false })
    expect(output).toContain('(unused)')
  })

  it('omits unused when omitUnused is true', () => {
    const graph: DependencyGraph = {
      cwd: '/project',
      entryId: '/project/a.ts',
      nodes: new Map([
        [
          '/project/a.ts',
          {
            id: '/project/a.ts',
            dependencies: [
              {
                specifier: './b',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: true,
                kind: 'source' as const,
                target: '/project/b.ts',
              },
            ],
          },
        ],
        ['/project/b.ts', { id: '/project/b.ts', dependencies: [] }],
      ]),
    }

    const output = printDependencyTree(graph, {
      color: false,
      omitUnused: true,
    })
    expect(output).not.toContain('b.ts')
  })

  it('shows reference kind prefixes', () => {
    const graph: DependencyGraph = {
      cwd: '/project',
      entryId: '/project/a.ts',
      nodes: new Map([
        [
          '/project/a.ts',
          {
            id: '/project/a.ts',
            dependencies: [
              {
                specifier: './b',
                referenceKind: 'require' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'source' as const,
                target: '/project/b.ts',
              },
              {
                specifier: './c',
                referenceKind: 'dynamic-import' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'source' as const,
                target: '/project/c.ts',
              },
              {
                specifier: './d',
                referenceKind: 'export' as const,
                isTypeOnly: true,
                unused: false,
                kind: 'source' as const,
                target: '/project/d.ts',
              },
            ],
          },
        ],
        ['/project/b.ts', { id: '/project/b.ts', dependencies: [] }],
        ['/project/c.ts', { id: '/project/c.ts', dependencies: [] }],
        ['/project/d.ts', { id: '/project/d.ts', dependencies: [] }],
      ]),
    }

    const output = printDependencyTree(graph, { color: false })
    expect(output).toContain('[require]')
    expect(output).toContain('[dynamic]')
    expect(output).toContain('[type, re-export]')
  })

  it('annotates missing dependencies', () => {
    const graph: DependencyGraph = {
      cwd: '/project',
      entryId: '/project/a.ts',
      nodes: new Map([
        [
          '/project/a.ts',
          {
            id: '/project/a.ts',
            dependencies: [
              {
                specifier: './missing',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'missing' as const,
                target: './missing',
              },
            ],
          },
        ],
      ]),
    }

    const output = printDependencyTree(graph, { color: false })
    expect(output).toContain('./missing [missing]')
  })

  it('annotates boundary dependencies', () => {
    const graph: DependencyGraph = {
      cwd: '/project',
      entryId: '/project/a.ts',
      nodes: new Map([
        [
          '/project/a.ts',
          {
            id: '/project/a.ts',
            dependencies: [
              {
                specifier: '../other/file',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'boundary' as const,
                target: '/other/file.ts',
                boundary: 'project' as const,
              },
              {
                specifier: '../workspace/file',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'boundary' as const,
                target: '/workspace/file.ts',
                boundary: 'workspace' as const,
              },
            ],
          },
        ],
      ]),
    }

    const output = printDependencyTree(graph, { color: false })
    expect(output).toContain('[project boundary]')
    expect(output).toContain('[workspace boundary]')
  })

  it('annotates builtin dependencies', () => {
    const graph: DependencyGraph = {
      cwd: '/project',
      entryId: '/project/a.ts',
      nodes: new Map([
        [
          '/project/a.ts',
          {
            id: '/project/a.ts',
            dependencies: [
              {
                specifier: 'node:fs',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'builtin' as const,
                target: 'node:fs',
              },
            ],
          },
        ],
      ]),
    }

    const output = printDependencyTree(graph, {
      color: false,
      includeExternals: true,
    })
    expect(output).toContain('node:fs [builtin]')
  })

  it('shows import-equals prefix', () => {
    const graph: DependencyGraph = {
      cwd: '/project',
      entryId: '/project/a.ts',
      nodes: new Map([
        [
          '/project/a.ts',
          {
            id: '/project/a.ts',
            dependencies: [
              {
                specifier: './b',
                referenceKind: 'import-equals' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'source' as const,
                target: '/project/b.ts',
              },
            ],
          },
        ],
        ['/project/b.ts', { id: '/project/b.ts', dependencies: [] }],
      ]),
    }

    const output = printDependencyTree(graph, { color: false })
    expect(output).toContain('[import=]')
  })
})
