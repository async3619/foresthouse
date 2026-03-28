import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { resolveExistingPath } from './entry.js'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true })
  })
})

function createTemporaryDirectory(): string {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'foresthouse-entry-path-')),
  )
  temporaryDirectories.push(directory)
  return directory
}

describe('resolveExistingPath', () => {
  it('resolves existing .ts file and returns normalized path', () => {
    const directory = createTemporaryDirectory()
    fs.writeFileSync(path.join(directory, 'main.ts'), 'export {}\n')

    expect(resolveExistingPath(directory, './main.ts')).toBe(
      path.join(directory, 'main.ts'),
    )
  })

  it('throws for non-existent file', () => {
    const directory = createTemporaryDirectory()

    expect(() => resolveExistingPath(directory, './nonexistent.ts')).toThrow(
      'Entry file not found',
    )
  })

  it('throws for non-source file (.json)', () => {
    const directory = createTemporaryDirectory()
    fs.writeFileSync(path.join(directory, 'data.json'), '{}\n')

    expect(() => resolveExistingPath(directory, './data.json')).toThrow(
      'Entry file must be a JS/TS source file',
    )
  })

  it('throws for non-source file (.css)', () => {
    const directory = createTemporaryDirectory()
    fs.writeFileSync(path.join(directory, 'styles.css'), 'body {}\n')

    expect(() => resolveExistingPath(directory, './styles.css')).toThrow(
      'Entry file must be a JS/TS source file',
    )
  })

  it('throws for non-source file (.md)', () => {
    const directory = createTemporaryDirectory()
    fs.writeFileSync(path.join(directory, 'readme.md'), '# Title\n')

    expect(() => resolveExistingPath(directory, './readme.md')).toThrow(
      'Entry file must be a JS/TS source file',
    )
  })

  it('resolves relative paths correctly', () => {
    const directory = createTemporaryDirectory()
    const subdir = path.join(directory, 'src')
    fs.mkdirSync(subdir)
    fs.writeFileSync(path.join(subdir, 'index.ts'), 'export {}\n')

    expect(resolveExistingPath(directory, './src/index.ts')).toBe(
      path.join(subdir, 'index.ts'),
    )
  })

  it('resolves .tsx files', () => {
    const directory = createTemporaryDirectory()
    fs.writeFileSync(
      path.join(directory, 'app.tsx'),
      'export const App = () => null\n',
    )

    expect(resolveExistingPath(directory, './app.tsx')).toBe(
      path.join(directory, 'app.tsx'),
    )
  })

  it('resolves .js files', () => {
    const directory = createTemporaryDirectory()
    fs.writeFileSync(path.join(directory, 'index.js'), 'module.exports = {}\n')

    expect(resolveExistingPath(directory, './index.js')).toBe(
      path.join(directory, 'index.js'),
    )
  })

  it('resolves .mts files', () => {
    const directory = createTemporaryDirectory()
    fs.writeFileSync(path.join(directory, 'util.mts'), 'export {}\n')

    expect(resolveExistingPath(directory, './util.mts')).toBe(
      path.join(directory, 'util.mts'),
    )
  })
})
