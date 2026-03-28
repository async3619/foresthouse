import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { analyzeDependencies, analyzeDependenciesForEntries } from './index.js'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true })
  })
})

function createTemporaryDirectory(): string {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'foresthouse-import-index-')),
  )
  temporaryDirectories.push(directory)
  return directory
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function writeTsconfig(directory: string): void {
  writeJson(path.join(directory, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2020',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
    },
  })
}

describe('analyzeDependencies', () => {
  it('exports a callable dependency analyzer', () => {
    expect(analyzeDependencies).toBeTypeOf('function')
  })

  it('analyzes single entry file with one import', () => {
    const dir = createTemporaryDirectory()
    writeTsconfig(dir)

    fs.writeFileSync(
      path.join(dir, 'entry.ts'),
      "import { helper } from './helper.js'\nconsole.log(helper)\n",
    )
    fs.writeFileSync(path.join(dir, 'helper.ts'), 'export const helper = 42\n')

    const graph = analyzeDependencies('./entry.ts', { cwd: dir })

    expect(graph.cwd).toBe(dir)
    expect(graph.entryId).toBe(path.join(dir, 'entry.ts'))
    expect(graph.nodes.size).toBeGreaterThanOrEqual(2)
    expect(graph.nodes.has(path.join(dir, 'entry.ts'))).toBe(true)
    expect(graph.nodes.has(path.join(dir, 'helper.ts'))).toBe(true)
  })

  it('throws when entry file does not exist', () => {
    const dir = createTemporaryDirectory()
    writeTsconfig(dir)

    expect(() => analyzeDependencies('./nonexistent.ts', { cwd: dir })).toThrow(
      'Entry file not found',
    )
  })

  it('returns correct cwd and entryId', () => {
    const dir = createTemporaryDirectory()
    writeTsconfig(dir)

    fs.writeFileSync(path.join(dir, 'main.ts'), 'export const x = 1\n')

    const graph = analyzeDependencies('./main.ts', { cwd: dir })

    expect(graph.cwd).toBe(dir)
    expect(graph.entryId).toBe(path.join(dir, 'main.ts'))
  })

  it('handles configPath option', () => {
    const dir = createTemporaryDirectory()
    writeJson(path.join(dir, 'custom-tsconfig.json'), {
      compilerOptions: {
        target: 'ES2020',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
      },
    })

    fs.writeFileSync(path.join(dir, 'index.ts'), 'export const a = 1\n')

    const graph = analyzeDependencies('./index.ts', {
      cwd: dir,
      configPath: 'custom-tsconfig.json',
    })

    expect(graph.entryId).toBe(path.join(dir, 'index.ts'))
    expect(graph.nodes.has(path.join(dir, 'index.ts'))).toBe(true)
  })
})

describe('analyzeDependenciesForEntries', () => {
  it('throws when no entry files provided', () => {
    expect(() => analyzeDependenciesForEntries([])).toThrow(
      'At least one entry file is required',
    )
  })

  it('populates entryIds array with multiple entries', () => {
    const dir = createTemporaryDirectory()
    writeTsconfig(dir)

    fs.writeFileSync(path.join(dir, 'a.ts'), 'export const a = 1\n')
    fs.writeFileSync(path.join(dir, 'b.ts'), 'export const b = 2\n')

    const graph = analyzeDependenciesForEntries(['./a.ts', './b.ts'], {
      cwd: dir,
    })

    expect(graph.entryIds).toHaveLength(2)
    expect(graph.entryIds).toContain(path.join(dir, 'a.ts'))
    expect(graph.entryIds).toContain(path.join(dir, 'b.ts'))
    expect(graph.entryId).toBe(path.join(dir, 'a.ts'))
  })
})
