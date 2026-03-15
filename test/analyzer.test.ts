import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  analyzeDependencies,
  graphToSerializableTree,
  printDependencyTree,
} from '../src/index.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const fixtureDirectory = path.join(currentDirectory, 'fixtures', 'basic')

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
})

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
