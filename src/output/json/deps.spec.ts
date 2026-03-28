import { describe, expect, it } from 'vitest'

import type { PackageDependencyDiffGraph } from '../../types/package-dependency-diff-graph.js'
import type { PackageDependencyGraph } from '../../types/package-dependency-graph.js'
import {
  diffGraphToSerializablePackageTree,
  graphToSerializablePackageTree,
} from './deps.js'

describe('graphToSerializablePackageTree', () => {
  it('serializes a root package with external dependencies', () => {
    const graph: PackageDependencyGraph = {
      repositoryRoot: '/repo',
      rootId: '/repo',
      nodes: new Map([
        [
          '/repo',
          {
            packageDir: '/repo',
            packageName: 'my-app',
            dependencies: [
              { kind: 'external', name: 'react', specifier: '^18.0.0' },
            ],
          },
        ],
      ]),
    }

    const tree = graphToSerializablePackageTree(graph) as Record<
      string,
      unknown
    >
    expect(tree.kind).toBe('root')
    expect(tree.packageName).toBe('my-app')
    expect(tree.label).toBe('my-app')

    const deps = tree.dependencies as Record<string, unknown>[]
    expect(deps).toHaveLength(1)
    expect(deps[0].kind).toBe('external')
    expect(deps[0].name).toBe('react')
    expect(deps[0].target).toBe('react@^18.0.0')
  })

  it('serializes workspace dependencies with nested nodes', () => {
    const graph: PackageDependencyGraph = {
      repositoryRoot: '/repo',
      rootId: '/repo',
      nodes: new Map([
        [
          '/repo',
          {
            packageDir: '/repo',
            packageName: 'my-app',
            dependencies: [
              {
                kind: 'workspace',
                name: '@my/lib',
                target: '/repo/packages/lib',
              },
            ],
          },
        ],
        [
          '/repo/packages/lib',
          {
            packageDir: '/repo/packages/lib',
            packageName: '@my/lib',
            dependencies: [],
          },
        ],
      ]),
    }

    const tree = graphToSerializablePackageTree(graph) as Record<
      string,
      unknown
    >
    const deps = tree.dependencies as Record<string, unknown>[]
    expect(deps[0].kind).toBe('workspace')
    expect(deps[0].node).toBeDefined()
    const node = deps[0].node as Record<string, unknown>
    expect(node.kind).toBe('workspace')
  })

  it('handles circular workspace references', () => {
    const graph: PackageDependencyGraph = {
      repositoryRoot: '/repo',
      rootId: '/repo/a',
      nodes: new Map([
        [
          '/repo/a',
          {
            packageDir: '/repo/a',
            packageName: 'pkg-a',
            dependencies: [
              { kind: 'workspace', name: 'pkg-b', target: '/repo/b' },
            ],
          },
        ],
        [
          '/repo/b',
          {
            packageDir: '/repo/b',
            packageName: 'pkg-b',
            dependencies: [
              { kind: 'workspace', name: 'pkg-a', target: '/repo/a' },
            ],
          },
        ],
      ]),
    }

    const tree = graphToSerializablePackageTree(graph) as Record<
      string,
      unknown
    >
    const deps = tree.dependencies as Record<string, unknown>[]
    const bNode = deps[0].node as Record<string, unknown>
    const bDeps = bNode.dependencies as Record<string, unknown>[]
    const circularNode = bDeps[0].node as Record<string, unknown>

    expect(circularNode.kind).toBe('circular')
    expect(circularNode.dependencies).toEqual([])
  })

  it('handles missing package nodes', () => {
    const graph: PackageDependencyGraph = {
      repositoryRoot: '/repo',
      rootId: '/repo/missing',
      nodes: new Map(),
    }

    const tree = graphToSerializablePackageTree(graph) as Record<
      string,
      unknown
    >
    expect(tree.kind).toBe('missing')
    expect(tree.dependencies).toEqual([])
  })
})

describe('diffGraphToSerializablePackageTree', () => {
  it('serializes a diff graph root node', () => {
    const graph: PackageDependencyDiffGraph = {
      repositoryRoot: '/repo',
      root: {
        kind: 'root',
        label: 'my-app',
        packageName: 'my-app',
        path: '.',
        change: 'changed',
        beforePackageName: 'old-app',
        afterPackageName: 'my-app',
        dependencies: [
          {
            kind: 'external',
            name: 'react',
            change: 'changed',
            specifierChanged: true,
            resolvedVersionChanged: false,
            peerContextChanged: false,
            before: { target: 'react@^17.0.0', specifier: '^17.0.0' },
            after: { target: 'react@^18.0.0', specifier: '^18.0.0' },
          },
        ],
      },
    }

    const tree = diffGraphToSerializablePackageTree(graph) as Record<
      string,
      unknown
    >
    expect(tree.kind).toBe('root')
    expect(tree.change).toBe('changed')
    expect(tree.beforePackageName).toBe('old-app')
    expect(tree.afterPackageName).toBe('my-app')

    const deps = tree.dependencies as Record<string, unknown>[]
    expect(deps).toHaveLength(1)
    expect(deps[0].change).toBe('changed')
    expect(deps[0].specifierChanged).toBe(true)
  })
})
