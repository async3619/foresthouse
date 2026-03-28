import { describe, expect, it } from 'vitest'

import type { DependencyGraph } from '../../types/dependency-graph.js'
import { graphToSerializableTree } from './import.js'

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

describe('graphToSerializableTree', () => {
  it('serializes a simple dependency graph', () => {
    const graph = createGraph()
    const tree = graphToSerializableTree(graph) as Record<string, unknown>

    expect(tree.path).toBe('src/index.ts')
    expect(tree.kind).toBe('entry')
    expect(Array.isArray(tree.dependencies)).toBe(true)
    const deps = tree.dependencies as Record<string, unknown>[]
    expect(deps).toHaveLength(2)
  })

  it('marks the entry node as entry kind', () => {
    const graph = createGraph()
    const tree = graphToSerializableTree(graph) as Record<string, unknown>
    expect(tree.kind).toBe('entry')
  })

  it('serializes source dependencies with nested nodes', () => {
    const graph = createGraph()
    const tree = graphToSerializableTree(graph) as Record<string, unknown>
    const deps = tree.dependencies as Record<string, unknown>[]
    const sourceDep = deps.find((d) => d.kind === 'source')
    expect(sourceDep).toBeDefined()
    expect(sourceDep?.target).toBe('src/utils.ts')
    expect(sourceDep?.node).toBeDefined()
  })

  it('serializes external dependencies without nested nodes', () => {
    const graph = createGraph()
    const tree = graphToSerializableTree(graph) as Record<string, unknown>
    const deps = tree.dependencies as Record<string, unknown>[]
    const extDep = deps.find((d) => d.kind === 'external')
    expect(extDep).toBeDefined()
    expect(extDep?.target).toBe('react')
    expect(extDep?.node).toBeUndefined()
  })

  it('handles circular references', () => {
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

    const tree = graphToSerializableTree(graph) as Record<string, unknown>
    const deps = tree.dependencies as Record<string, unknown>[]
    const firstDep = deps[0] as Record<string, unknown>
    const bNode = firstDep.node as Record<string, unknown>
    const bDeps = bNode.dependencies as Record<string, unknown>[]
    const circularDep = bDeps[0] as Record<string, unknown>
    const circularNode = circularDep.node as Record<string, unknown>

    expect(circularNode.kind).toBe('circular')
    expect(circularNode.dependencies).toEqual([])
  })

  it('handles shared nodes (deduplication)', () => {
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

    const tree = graphToSerializableTree(graph) as Record<string, unknown>
    const deps = tree.dependencies as Record<string, unknown>[]
    const secondDep = deps[1] as Record<string, unknown>
    const cDep = secondDep.node as Record<string, unknown>

    expect(cDep.kind).toBe('shared')
    expect(cDep.dependencies).toEqual([])
  })

  it('handles missing nodes', () => {
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
                kind: 'source' as const,
                target: '/project/missing.ts',
              },
            ],
          },
        ],
      ]),
    }

    const tree = graphToSerializableTree(graph) as Record<string, unknown>
    const deps = tree.dependencies as Record<string, unknown>[]
    const missingDep = deps[0] as Record<string, unknown>
    const missingNode = missingDep.node as Record<string, unknown>

    expect(missingNode.kind).toBe('missing')
  })

  it('omits unused dependencies when omitUnused is true', () => {
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
                specifier: './used',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: false,
                kind: 'source' as const,
                target: '/project/used.ts',
              },
              {
                specifier: './unused',
                referenceKind: 'import' as const,
                isTypeOnly: false,
                unused: true,
                kind: 'source' as const,
                target: '/project/unused.ts',
              },
            ],
          },
        ],
        ['/project/used.ts', { id: '/project/used.ts', dependencies: [] }],
        ['/project/unused.ts', { id: '/project/unused.ts', dependencies: [] }],
      ]),
    }

    const tree = graphToSerializableTree(graph, { omitUnused: true }) as Record<
      string,
      unknown
    >
    const deps = tree.dependencies as Record<string, unknown>[]

    expect(deps).toHaveLength(1)
    const usedDep = deps[0] as Record<string, unknown>
    expect(usedDep.target).toBe('used.ts')
  })

  it('serializes boundary dependencies', () => {
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
            ],
          },
        ],
      ]),
    }

    const tree = graphToSerializableTree(graph) as Record<string, unknown>
    const deps = tree.dependencies as Record<string, unknown>[]
    const boundaryDep = deps[0] as Record<string, unknown>
    expect(boundaryDep.kind).toBe('boundary')
    expect(boundaryDep.boundary).toBe('project')
  })

  it('serializes missing dependency targets directly', () => {
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

    const tree = graphToSerializableTree(graph) as Record<string, unknown>
    const deps = tree.dependencies as Record<string, unknown>[]
    const missingTargetDep = deps[0] as Record<string, unknown>
    expect(missingTargetDep.target).toBe('./missing')
  })

  it('includes referenceKind and isTypeOnly in serialized deps', () => {
    const graph = createGraph()
    const tree = graphToSerializableTree(graph) as Record<string, unknown>
    const deps = tree.dependencies as Record<string, unknown>[]
    const refDep = deps[0] as Record<string, unknown>
    expect(refDep.referenceKind).toBe('import')
    expect(refDep.isTypeOnly).toBe(false)
  })
})
