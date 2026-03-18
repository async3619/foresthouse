import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { main } from '../src/app/cli.js'
import { runCli } from '../src/app/run.js'
import {
  analyzeDependencies,
  graphToSerializableTree,
  printDependencyTree,
} from '../src/index.js'
import type { DependencyEdge } from '../src/types/dependency-edge.js'
import type { DependencyGraph } from '../src/types/dependency-graph.js'

vi.mock('../src/app/run.js', () => ({
  runCli: vi.fn(),
}))

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const fixtureDirectory = path.join(
  currentDirectory,
  '..',
  'test',
  'fixtures',
  'basic',
)
const monorepoFixtureDirectory = path.join(
  currentDirectory,
  '..',
  'test',
  'fixtures',
  'monorepo',
  'packages',
  'app',
)
const nodeModulesConfigFixtureDirectory = path.join(
  currentDirectory,
  '..',
  'test',
  'fixtures',
  'node-modules-config',
)

beforeEach(() => {
  vi.mocked(runCli).mockReset()
})

describe('import command options', () => {
  it('passes parsed import options to the CLI runner', () => {
    main('1.2.3', [
      'import',
      'src/main.tsx',
      '--cwd',
      'test/fixtures/react-mode',
      '--config',
      'tsconfig.json',
      '--no-workspaces',
      '--project-only',
      '--include-externals',
      '--no-unused',
      '--json',
    ])

    expect(runCli).toHaveBeenCalledWith({
      command: 'import',
      entryFile: 'src/main.tsx',
      cwd: 'test/fixtures/react-mode',
      configPath: 'tsconfig.json',
      expandWorkspaces: false,
      projectOnly: true,
      includeExternals: true,
      omitUnused: true,
      json: true,
    })
  })

  it('supports import --entry', () => {
    main('1.2.3', ['import', '--entry', 'src/main.tsx'])

    expect(runCli).toHaveBeenCalledWith({
      command: 'import',
      entryFile: 'src/main.tsx',
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      includeExternals: false,
      omitUnused: false,
      json: false,
    })
  })
})

describe('analyzeDependencies', () => {
  it('resolves relative imports and tsconfig path aliases', () => {
    const graph = analyzeDependencies('src/main.ts', {
      cwd: fixtureDirectory,
    })

    expect(graph.nodes.has(path.join(fixtureDirectory, 'src', 'main.ts'))).toBe(
      true,
    )
    expect(graph.nodes.has(path.join(fixtureDirectory, 'src', 'app.tsx'))).toBe(
      true,
    )
    expect(
      graph.nodes.has(path.join(fixtureDirectory, 'src', 'shared', 'util.ts')),
    ).toBe(true)
    expect(
      graph.nodes.has(path.join(fixtureDirectory, 'src', 'unused-helper.ts')),
    ).toBe(true)
  })

  it('prints a readable tree, marks unused imports, and hides externals by default', () => {
    const graph = analyzeDependencies('src/main.ts', {
      cwd: fixtureDirectory,
    })

    const output = printDependencyTree(graph, {
      color: false,
    })

    expect(output).toContain('src/main.ts')
    expect(output).toContain('src/app.tsx')
    expect(output).toContain('src/components/button.tsx')
    expect(output).toContain('src/unused-helper.ts (unused)')
    expect(output).not.toContain('typescript [external]')
    expect(output).not.toContain('node:path [builtin]')
  })

  it('can omit unused dependencies from the tree output', () => {
    const graph = analyzeDependencies('src/main.ts', {
      cwd: fixtureDirectory,
    })

    const output = printDependencyTree(graph, {
      color: false,
      omitUnused: true,
    })

    expect(output).not.toContain('src/unused-helper.ts')
  })

  it('can expose externals and json output when requested', () => {
    const graph = analyzeDependencies('src/main.ts', {
      cwd: fixtureDirectory,
    })

    const treeOutput = printDependencyTree(graph, {
      color: false,
      includeExternals: true,
    })
    const jsonTree = graphToSerializableTree(graph)

    expect(treeOutput).toContain('typescript [external]')
    expect(treeOutput).toContain('node:path [builtin]')
    expect(jsonTree).toMatchObject({
      kind: 'entry',
      path: 'src/main.ts',
    })
    expect(
      findDependencyByPath(jsonTree, 'src/unused-helper.ts'),
    ).toMatchObject({
      kind: 'source',
      path: 'src/unused-helper.ts',
    })
    expect(
      findDependencyEdgeByTarget(jsonTree, 'src/unused-helper.ts'),
    ).toMatchObject({
      target: 'src/unused-helper.ts',
      unused: true,
    })
  })

  it('can omit unused dependencies from json output', () => {
    const graph = analyzeDependencies('src/main.ts', {
      cwd: fixtureDirectory,
    })

    const jsonTree = graphToSerializableTree(graph, {
      omitUnused: true,
    })

    expect(
      findDependencyByPath(jsonTree, 'src/unused-helper.ts'),
    ).toBeUndefined()
    expect(
      findDependencyEdgeByTarget(jsonTree, 'src/unused-helper.ts'),
    ).toBeUndefined()
  })

  it('can colorize the unused marker when requested', () => {
    const graph = analyzeDependencies('src/main.ts', {
      cwd: fixtureDirectory,
    })

    const output = printDependencyTree(graph, {
      color: true,
    })

    expect(output).toContain(
      'src/unused-helper.ts \u001B[38;5;214m(unused)\u001B[0m',
    )
  })

  it('renders shared source subgraphs only once in ascii output', () => {
    const graph = createSharedSubgraphFixture()

    const output = printDependencyTree(graph, {
      color: false,
    })

    expect(output).toContain('src/shared.ts')
    expect(output).toContain('src/shared.ts (shared)')
    expect(output).toContain('src/shared-leaf.ts')
    expect(output.match(/src\/shared-leaf\.ts/g)).toHaveLength(1)
  })

  it('serializes repeated source subgraphs as shared references in json output', () => {
    const graph = createSharedSubgraphFixture()

    const jsonTree = graphToSerializableTree(graph)

    expect(jsonTree).toMatchObject({
      kind: 'entry',
      path: 'src/entry.ts',
      dependencies: [
        {
          target: 'src/left.ts',
          node: {
            kind: 'source',
            path: 'src/left.ts',
            dependencies: [
              {
                target: 'src/shared.ts',
                node: {
                  kind: 'source',
                  path: 'src/shared.ts',
                  dependencies: [
                    {
                      target: 'src/shared-leaf.ts',
                      node: {
                        kind: 'source',
                        path: 'src/shared-leaf.ts',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          target: 'src/right.ts',
          node: {
            kind: 'source',
            path: 'src/right.ts',
            dependencies: [
              {
                target: 'src/shared.ts',
                node: {
                  kind: 'shared',
                  path: 'src/shared.ts',
                  dependencies: [],
                },
              },
            ],
          },
        },
      ],
    })
  })

  it('expands sibling workspace packages and their own tsconfig aliases by default', () => {
    const graph = analyzeDependencies('src/main.ts', {
      cwd: monorepoFixtureDirectory,
    })

    expect(
      graph.nodes.has(path.join(monorepoFixtureDirectory, 'src', 'main.ts')),
    ).toBe(true)
    expect(
      graph.nodes.has(
        path.join(monorepoFixtureDirectory, '..', 'shared', 'src', 'index.ts'),
      ),
    ).toBe(true)
    expect(
      graph.nodes.has(
        path.join(
          monorepoFixtureDirectory,
          '..',
          'shared',
          'src',
          'internal',
          'feature.ts',
        ),
      ),
    ).toBe(true)

    const output = printDependencyTree(graph, {
      color: false,
    })

    expect(output).toContain(
      path.join(monorepoFixtureDirectory, '..', 'shared', 'src', 'index.ts'),
    )
    expect(output).toContain(
      path.join(
        monorepoFixtureDirectory,
        '..',
        'shared',
        'src',
        'internal',
        'feature.ts',
      ),
    )
  })

  it('can stop at sibling workspace boundaries when workspace expansion is disabled', () => {
    const graph = analyzeDependencies('src/main.ts', {
      cwd: monorepoFixtureDirectory,
      expandWorkspaces: false,
    })

    expect(
      graph.nodes.has(
        path.join(monorepoFixtureDirectory, '..', 'shared', 'src', 'index.ts'),
      ),
    ).toBe(false)

    const output = printDependencyTree(graph, {
      color: false,
    })
    const jsonTree = graphToSerializableTree(graph)

    expect(output).toContain(
      `${path.join(
        monorepoFixtureDirectory,
        '..',
        'shared',
        'src',
        'index.ts',
      )} [workspace boundary]`,
    )
    expect(jsonTree).toMatchObject({
      dependencies: [
        expect.objectContaining({
          kind: 'boundary',
          boundary: 'workspace',
          target: path.join(
            monorepoFixtureDirectory,
            '..',
            'shared',
            'src',
            'index.ts',
          ),
        }),
      ],
    })
  })

  it('can restrict traversal to the active TypeScript project', () => {
    const graph = analyzeDependencies('src/main.ts', {
      cwd: monorepoFixtureDirectory,
      projectOnly: true,
    })

    expect(
      graph.nodes.has(
        path.join(monorepoFixtureDirectory, '..', 'shared', 'src', 'index.ts'),
      ),
    ).toBe(false)

    const output = printDependencyTree(graph, {
      color: false,
    })

    expect(output).toContain(
      `${path.join(
        monorepoFixtureDirectory,
        '..',
        'shared',
        'src',
        'index.ts',
      )} [project boundary]`,
    )
  })

  it('ignores package-internal tsconfig files under node_modules during config lookup', () => {
    expect(() =>
      analyzeDependencies('src/main.ts', {
        cwd: nodeModulesConfigFixtureDirectory,
      }),
    ).not.toThrow()

    const graph = analyzeDependencies('src/main.ts', {
      cwd: nodeModulesConfigFixtureDirectory,
    })
    const output = printDependencyTree(graph, {
      color: false,
      includeExternals: true,
    })

    expect(output).toContain('broken-package [external]')
  })
})

function createSharedSubgraphFixture(): DependencyGraph {
  const cwd = '/repo'
  const entryId = path.join(cwd, 'src', 'entry.ts')
  const leftId = path.join(cwd, 'src', 'left.ts')
  const rightId = path.join(cwd, 'src', 'right.ts')
  const sharedId = path.join(cwd, 'src', 'shared.ts')
  const leafId = path.join(cwd, 'src', 'shared-leaf.ts')

  return {
    cwd,
    entryId,
    nodes: new Map([
      [
        entryId,
        {
          id: entryId,
          dependencies: [
            createSourceEdge('./left', leftId),
            createSourceEdge('./right', rightId),
          ],
        },
      ],
      [
        leftId,
        {
          id: leftId,
          dependencies: [createSourceEdge('./shared', sharedId)],
        },
      ],
      [
        rightId,
        {
          id: rightId,
          dependencies: [createSourceEdge('./shared', sharedId)],
        },
      ],
      [
        sharedId,
        {
          id: sharedId,
          dependencies: [createSourceEdge('./shared-leaf', leafId)],
        },
      ],
      [
        leafId,
        {
          id: leafId,
          dependencies: [],
        },
      ],
    ]),
  }
}

function createSourceEdge(specifier: string, target: string): DependencyEdge {
  return {
    specifier,
    referenceKind: 'import',
    isTypeOnly: false,
    unused: false,
    kind: 'source',
    target,
  }
}

function findDependencyByPath(
  tree: object,
  targetPath: string,
): Record<string, unknown> | undefined {
  if (!isRecord(tree)) {
    return undefined
  }

  if (tree.path === targetPath) {
    return tree
  }

  const dependencies = Array.isArray(tree.dependencies) ? tree.dependencies : []
  for (const dependency of dependencies) {
    if (!isRecord(dependency) || !isRecord(dependency.node)) {
      continue
    }

    const match = findDependencyByPath(dependency.node, targetPath)
    if (match !== undefined) {
      return match
    }
  }

  return undefined
}

function findDependencyEdgeByTarget(
  tree: object,
  targetPath: string,
): Record<string, unknown> | undefined {
  if (!isRecord(tree)) {
    return undefined
  }

  const dependencies = Array.isArray(tree.dependencies) ? tree.dependencies : []
  for (const dependency of dependencies) {
    if (!isRecord(dependency)) {
      continue
    }

    if (dependency.target === targetPath) {
      return dependency
    }

    if (isRecord(dependency.node)) {
      const match = findDependencyEdgeByTarget(dependency.node, targetPath)
      if (match !== undefined) {
        return match
      }
    }
  }

  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
