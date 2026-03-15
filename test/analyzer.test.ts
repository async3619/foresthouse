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
  })

  it('prints a readable tree and hides externals by default', () => {
    const graph = analyzeDependencies('src/main.ts', {
      cwd: fixtureDirectory,
    })

    const output = printDependencyTree(graph)

    expect(output).toContain('src/main.ts')
    expect(output).toContain('src/app.tsx')
    expect(output).toContain('src/components/button.tsx')
    expect(output).not.toContain('typescript [external]')
    expect(output).not.toContain('node:path [builtin]')
  })

  it('can expose externals and json output when requested', () => {
    const graph = analyzeDependencies('src/main.ts', {
      cwd: fixtureDirectory,
    })

    const treeOutput = printDependencyTree(graph, {
      includeExternals: true,
    })
    const jsonTree = graphToSerializableTree(graph)

    expect(treeOutput).toContain('typescript [external]')
    expect(treeOutput).toContain('node:path [builtin]')
    expect(jsonTree).toMatchObject({
      kind: 'entry',
      path: 'src/main.ts',
    })
  })
})
