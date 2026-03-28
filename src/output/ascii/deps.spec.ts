import { describe, expect, it } from 'vitest'

import type { PackageDependencyDiffGraph } from '../../types/package-dependency-diff-graph.js'
import type { PackageDependencyGraph } from '../../types/package-dependency-graph.js'
import {
  printPackageDependencyDiffTree,
  printPackageDependencyTree,
} from './deps.js'

describe('printPackageDependencyTree', () => {
  it('prints a simple package tree', () => {
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

    const output = printPackageDependencyTree(graph)
    expect(output).toBe('my-app\n└─ react@^18.0.0')
  })

  it('prints workspace dependencies with path', () => {
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

    const output = printPackageDependencyTree(graph)
    expect(output).toContain('packages/lib')
  })

  it('prints workspace dependency with specifier', () => {
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
                specifier: 'workspace:*',
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

    const output = printPackageDependencyTree(graph)
    expect(output).toContain('(workspace:*)')
  })

  it('marks circular workspace references', () => {
    const graph: PackageDependencyGraph = {
      repositoryRoot: '/repo',
      rootId: '/repo/a',
      nodes: new Map([
        [
          '/repo/a',
          {
            packageDir: '/repo/a',
            packageName: 'a',
            dependencies: [{ kind: 'workspace', name: 'b', target: '/repo/b' }],
          },
        ],
        [
          '/repo/b',
          {
            packageDir: '/repo/b',
            packageName: 'b',
            dependencies: [{ kind: 'workspace', name: 'a', target: '/repo/a' }],
          },
        ],
      ]),
    }

    const output = printPackageDependencyTree(graph)
    expect(output).toContain('(circular)')
  })

  it('handles missing root node', () => {
    const graph: PackageDependencyGraph = {
      repositoryRoot: '/repo',
      rootId: '/repo/missing',
      nodes: new Map(),
    }

    const output = printPackageDependencyTree(graph)
    expect(output).toBe('missing')
  })

  it('prints multiple dependencies with correct tree chars', () => {
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
              { kind: 'external', name: 'lodash', specifier: '^4.0.0' },
            ],
          },
        ],
      ]),
    }

    const output = printPackageDependencyTree(graph)
    expect(output).toContain('├─ react@^18.0.0')
    expect(output).toContain('└─ lodash@^4.0.0')
  })
})

describe('printPackageDependencyDiffTree', () => {
  it('prints a diff tree with added dependencies', () => {
    const graph: PackageDependencyDiffGraph = {
      repositoryRoot: '/repo',
      root: {
        kind: 'root',
        label: 'my-app',
        packageName: 'my-app',
        path: '.',
        change: 'unchanged',
        dependencies: [
          {
            kind: 'external',
            name: 'react',
            change: 'added',
            specifierChanged: false,
            resolvedVersionChanged: false,
            peerContextChanged: false,
            after: { target: 'react@^18.0.0', specifier: '^18.0.0' },
          },
        ],
      },
    }

    const output = printPackageDependencyDiffTree(graph, { color: false })
    expect(output).toContain('+ react@^18.0.0')
  })

  it('prints removed dependencies', () => {
    const graph: PackageDependencyDiffGraph = {
      repositoryRoot: '/repo',
      root: {
        kind: 'root',
        label: 'my-app',
        packageName: 'my-app',
        path: '.',
        change: 'unchanged',
        dependencies: [
          {
            kind: 'external',
            name: 'lodash',
            change: 'removed',
            specifierChanged: false,
            resolvedVersionChanged: false,
            peerContextChanged: false,
            before: { target: 'lodash@^4.0.0', specifier: '^4.0.0' },
          },
        ],
      },
    }

    const output = printPackageDependencyDiffTree(graph, { color: false })
    expect(output).toContain('- lodash@^4.0.0')
  })

  it('prints changed root with before/after package names', () => {
    const graph: PackageDependencyDiffGraph = {
      repositoryRoot: '/repo',
      root: {
        kind: 'root',
        label: 'my-app',
        packageName: 'my-app',
        path: '.',
        change: 'changed',
        beforePackageName: 'old-name',
        afterPackageName: 'new-name',
        dependencies: [],
      },
    }

    const output = printPackageDependencyDiffTree(graph, { color: false })
    expect(output).toContain('old-name -> new-name')
  })

  it('prints changed external with version change', () => {
    const graph: PackageDependencyDiffGraph = {
      repositoryRoot: '/repo',
      root: {
        kind: 'root',
        label: 'my-app',
        packageName: 'my-app',
        path: '.',
        change: 'unchanged',
        dependencies: [
          {
            kind: 'external',
            name: 'react',
            change: 'changed',
            specifierChanged: true,
            resolvedVersionChanged: true,
            peerContextChanged: false,
            before: {
              target: 'react@^17.0.0',
              specifier: '^17.0.0',
              resolvedVersion: '17.0.2',
            },
            after: {
              target: 'react@^18.0.0',
              specifier: '^18.0.0',
              resolvedVersion: '18.2.0',
            },
          },
        ],
      },
    }

    const output = printPackageDependencyDiffTree(graph, { color: false })
    expect(output).toContain('17.0.2 -> 18.2.0')
  })

  it('prints changed external with same specifier but resolved version change', () => {
    const graph: PackageDependencyDiffGraph = {
      repositoryRoot: '/repo',
      root: {
        kind: 'root',
        label: 'my-app',
        packageName: 'my-app',
        path: '.',
        change: 'unchanged',
        dependencies: [
          {
            kind: 'external',
            name: 'react',
            change: 'changed',
            specifierChanged: false,
            resolvedVersionChanged: true,
            peerContextChanged: false,
            before: {
              target: 'react@^18.0.0',
              specifier: '^18.0.0',
              resolvedVersion: '18.2.0',
            },
            after: {
              target: 'react@^18.0.0',
              specifier: '^18.0.0',
              resolvedVersion: '18.3.1',
            },
          },
        ],
      },
    }

    const output = printPackageDependencyDiffTree(graph, { color: false })
    expect(output).toContain('react@^18.0.0')
    expect(output).toContain('18.2.0 -> 18.3.1')
  })

  it('prints changed external with different specifier no resolved version', () => {
    const graph: PackageDependencyDiffGraph = {
      repositoryRoot: '/repo',
      root: {
        kind: 'root',
        label: 'my-app',
        packageName: 'my-app',
        path: '.',
        change: 'unchanged',
        dependencies: [
          {
            kind: 'external',
            name: 'lodash',
            change: 'changed',
            specifierChanged: true,
            resolvedVersionChanged: false,
            peerContextChanged: false,
            before: { target: 'lodash@^3.0.0', specifier: '^3.0.0' },
            after: { target: 'lodash@^4.0.0', specifier: '^4.0.0' },
          },
        ],
      },
    }

    const output = printPackageDependencyDiffTree(graph, { color: false })
    expect(output).toContain('lodash@^3.0.0 -> ^4.0.0')
  })

  it('shows workspace diff with changed child node', () => {
    const graph: PackageDependencyDiffGraph = {
      repositoryRoot: '/repo',
      root: {
        kind: 'root',
        label: 'my-app',
        packageName: 'my-app',
        path: '.',
        change: 'unchanged',
        dependencies: [
          {
            kind: 'workspace',
            name: '@my/lib',
            change: 'unchanged',
            node: {
              kind: 'workspace',
              label: '@my/lib',
              packageName: '@my/lib',
              path: 'packages/lib',
              change: 'changed',
              dependencies: [],
            },
          },
        ],
      },
    }

    const output = printPackageDependencyDiffTree(graph, { color: false })
    expect(output).toContain('~')
    expect(output).toContain('packages/lib')
  })

  it('shows workspace diff with specifier change', () => {
    const graph: PackageDependencyDiffGraph = {
      repositoryRoot: '/repo',
      root: {
        kind: 'root',
        label: 'my-app',
        packageName: 'my-app',
        path: '.',
        change: 'unchanged',
        dependencies: [
          {
            kind: 'workspace',
            name: '@my/lib',
            change: 'changed',
            before: {
              target: 'packages/lib',
              specifier: 'workspace:^1.0.0',
            },
            after: {
              target: 'packages/lib',
              specifier: 'workspace:^2.0.0',
            },
            node: {
              kind: 'workspace',
              label: '@my/lib',
              packageName: '@my/lib',
              path: 'packages/lib',
              change: 'unchanged',
              dependencies: [],
            },
          },
        ],
      },
    }

    const output = printPackageDependencyDiffTree(graph, { color: false })
    expect(output).toContain('workspace:^1.0.0 -> workspace:^2.0.0')
  })

  it('renders unchanged external deps without marker', () => {
    const graph: PackageDependencyDiffGraph = {
      repositoryRoot: '/repo',
      root: {
        kind: 'root',
        label: 'my-app',
        packageName: 'my-app',
        path: '.',
        change: 'unchanged',
        dependencies: [
          {
            kind: 'external',
            name: 'lodash',
            change: 'unchanged',
            specifierChanged: false,
            resolvedVersionChanged: false,
            peerContextChanged: false,
            after: { target: 'lodash@^4.0.0', specifier: '^4.0.0' },
          },
        ],
      },
    }

    const output = printPackageDependencyDiffTree(graph, { color: false })
    expect(output).toContain('lodash@^4.0.0')
    expect(output).not.toContain('+ ')
    expect(output).not.toContain('- ')
    expect(output).not.toContain('~ ')
  })

  it('handles circular workspace diff nodes', () => {
    const graph: PackageDependencyDiffGraph = {
      repositoryRoot: '/repo',
      root: {
        kind: 'root',
        label: 'my-app',
        packageName: 'my-app',
        path: '.',
        change: 'unchanged',
        dependencies: [
          {
            kind: 'workspace',
            name: 'pkg-a',
            change: 'unchanged',
            node: {
              kind: 'circular',
              label: 'pkg-a',
              packageName: 'pkg-a',
              path: 'packages/a',
              change: 'unchanged',
              dependencies: [],
            },
          },
        ],
      },
    }

    const output = printPackageDependencyDiffTree(graph, { color: false })
    expect(output).toContain('(circular)')
  })
})
