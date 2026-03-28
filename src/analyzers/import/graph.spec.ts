import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { buildDependencyGraph } from './graph.js'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true })
  })
})

function createTemporaryDirectory(): string {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'foresthouse-import-graph-')),
  )
  temporaryDirectories.push(directory)
  return directory
}

describe('buildDependencyGraph', () => {
  it('exports a callable graph builder', () => {
    expect(buildDependencyGraph).toBeTypeOf('function')
  })

  it('builds a graph without TypeScript program creation', () => {
    const fixtureDir = createTemporaryDirectory()
    const entryPath = path.join(fixtureDir, 'entry.ts')

    fs.writeFileSync(entryPath, "import './dependency'\n")
    fs.writeFileSync(
      path.join(fixtureDir, 'dependency.ts'),
      'export const dependency = 1\n',
    )

    const nodes = buildDependencyGraph(
      [
        {
          entryPath,
          compilerOptions: {},
        },
      ],
      {
        cwd: fixtureDir,
        expandWorkspaces: true,
        projectOnly: false,
        trackUnusedImports: false,
      },
    )

    expect(nodes.has(entryPath)).toBe(true)
    expect(nodes.size).toBeGreaterThan(0)
  })

  it('builds a graph from a chain of imports', () => {
    const dir = createTemporaryDirectory()
    const entryPath = path.join(dir, 'entry.ts')
    const middlePath = path.join(dir, 'middle.ts')
    const leafPath = path.join(dir, 'leaf.ts')

    fs.writeFileSync(
      entryPath,
      "import { mid } from './middle.js'\nconsole.log(mid)\n",
    )
    fs.writeFileSync(
      middlePath,
      "import { leaf } from './leaf.js'\nexport const mid = leaf\n",
    )
    fs.writeFileSync(leafPath, 'export const leaf = 42\n')

    const nodes = buildDependencyGraph([{ entryPath, compilerOptions: {} }], {
      cwd: dir,
      expandWorkspaces: true,
      projectOnly: false,
      trackUnusedImports: false,
    })

    expect(nodes.size).toBe(3)
    expect(nodes.has(entryPath)).toBe(true)
    expect(nodes.has(middlePath)).toBe(true)
    expect(nodes.has(leafPath)).toBe(true)

    const entryNode = nodes.get(entryPath)
    if (!entryNode) throw new Error('Expected entry node to exist')
    const entryDeps = entryNode.dependencies.filter((d) => d.kind === 'source')
    expect(entryDeps).toHaveLength(1)
    expect(entryDeps[0]?.target).toBe(middlePath)

    const middleNode = nodes.get(middlePath)
    if (!middleNode) throw new Error('Expected middle node to exist')
    const middleDeps = middleNode.dependencies.filter(
      (d) => d.kind === 'source',
    )
    expect(middleDeps).toHaveLength(1)
    expect(middleDeps[0]?.target).toBe(leafPath)
  })

  it('handles circular imports', () => {
    const dir = createTemporaryDirectory()
    const aPath = path.join(dir, 'a.ts')
    const bPath = path.join(dir, 'b.ts')

    fs.writeFileSync(aPath, "import { b } from './b.js'\nexport const a = b\n")
    fs.writeFileSync(bPath, "import { a } from './a.js'\nexport const b = a\n")

    const nodes = buildDependencyGraph(
      [{ entryPath: aPath, compilerOptions: {} }],
      {
        cwd: dir,
        expandWorkspaces: true,
        projectOnly: false,
        trackUnusedImports: false,
      },
    )

    expect(nodes.size).toBe(2)
    expect(nodes.has(aPath)).toBe(true)
    expect(nodes.has(bPath)).toBe(true)
  })

  it('handles missing imports gracefully', () => {
    const dir = createTemporaryDirectory()
    const entryPath = path.join(dir, 'entry.ts')

    fs.writeFileSync(
      entryPath,
      "import { x } from './nonexistent.js'\nconsole.log(x)\n",
    )

    const nodes = buildDependencyGraph([{ entryPath, compilerOptions: {} }], {
      cwd: dir,
      expandWorkspaces: true,
      projectOnly: false,
      trackUnusedImports: false,
    })

    expect(nodes.size).toBe(1)
    expect(nodes.has(entryPath)).toBe(true)

    const entryNode = nodes.get(entryPath)
    if (!entryNode) throw new Error('Expected entry node to exist')
    const missingDeps = entryNode.dependencies.filter(
      (d) => d.kind === 'missing',
    )
    expect(missingDeps.length).toBeGreaterThanOrEqual(1)
  })

  it('tracks unused imports when option is enabled', () => {
    const dir = createTemporaryDirectory()
    const entryPath = path.join(dir, 'entry.ts')
    const helperPath = path.join(dir, 'helper.ts')

    fs.writeFileSync(
      entryPath,
      "import { unused } from './helper.js'\nexport const x = 1\n",
    )
    fs.writeFileSync(helperPath, 'export const unused = 42\n')

    const nodes = buildDependencyGraph([{ entryPath, compilerOptions: {} }], {
      cwd: dir,
      expandWorkspaces: true,
      projectOnly: false,
      trackUnusedImports: true,
    })

    const entryNode = nodes.get(entryPath)
    if (!entryNode) throw new Error('Expected entry node to exist')
    const helperDep = entryNode.dependencies.find(
      (d) => d.kind === 'source' && d.target === helperPath,
    )
    expect(helperDep?.unused).toBe(true)
  })

  it('handles multiple entry configs', () => {
    const dir = createTemporaryDirectory()
    const aPath = path.join(dir, 'a.ts')
    const bPath = path.join(dir, 'b.ts')

    fs.writeFileSync(aPath, 'export const a = 1\n')
    fs.writeFileSync(bPath, 'export const b = 2\n')

    const nodes = buildDependencyGraph(
      [
        { entryPath: aPath, compilerOptions: {} },
        { entryPath: bPath, compilerOptions: {} },
      ],
      {
        cwd: dir,
        expandWorkspaces: true,
        projectOnly: false,
        trackUnusedImports: false,
      },
    )

    expect(nodes.has(aPath)).toBe(true)
    expect(nodes.has(bPath)).toBe(true)
  })
})
