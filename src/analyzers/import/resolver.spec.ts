import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ResolverFactory } from 'oxc-resolver'
import { afterEach, describe, expect, it } from 'vitest'

import { resolveDependency } from './resolver.js'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true })
  })
})

function createTemporaryDirectory(): string {
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'foresthouse-resolver-')),
  )
  temporaryDirectories.push(directory)
  return directory
}

function createDefaultOptions(cwd: string) {
  return {
    cwd,
    expandWorkspaces: true,
    projectOnly: false,
    getConfigForFile: () => ({
      compilerOptions: {
        module: 199 as const,
        moduleResolution: 99 as const,
        target: 99 as const,
      },
    }),
    getResolverForFile: () =>
      new ResolverFactory({
        builtinModules: true,
        conditionNames: ['import', 'require', 'default'],
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts'],
        mainFields: ['types', 'module', 'main'],
      }),
  }
}

describe('resolveDependency', () => {
  it('classifies builtin modules without filesystem resolution', () => {
    expect(
      resolveDependency(
        {
          specifier: 'node:path',
          referenceKind: 'import',
          isTypeOnly: false,
          unused: false,
        },
        '/repo/src/main.ts',
        {
          cwd: '/repo',
          expandWorkspaces: true,
          projectOnly: false,
          getConfigForFile: () => ({ compilerOptions: {} }),
          getResolverForFile: () =>
            new ResolverFactory({ builtinModules: true }),
        },
      ),
    ).toMatchObject({
      kind: 'builtin',
      target: 'node:path',
    })
  })

  it('resolves relative .ts imports as source kind', () => {
    const dir = createTemporaryDirectory()
    const entryFile = path.join(dir, 'entry.ts')
    const helperFile = path.join(dir, 'helper.ts')

    fs.writeFileSync(entryFile, "import { x } from './helper.js'\n")
    fs.writeFileSync(helperFile, 'export const x = 1\n')

    const result = resolveDependency(
      {
        specifier: './helper.js',
        referenceKind: 'import',
        isTypeOnly: false,
        unused: false,
      },
      entryFile,
      createDefaultOptions(dir),
    )

    expect(result.kind).toBe('source')
    expect(result.target).toBe(helperFile)
  })

  it('resolves bare specifiers as external kind', () => {
    const dir = createTemporaryDirectory()
    const entryFile = path.join(dir, 'entry.ts')

    fs.writeFileSync(entryFile, "import lodash from 'lodash'\n")

    const result = resolveDependency(
      {
        specifier: 'lodash',
        referenceKind: 'import',
        isTypeOnly: false,
        unused: false,
      },
      entryFile,
      createDefaultOptions(dir),
    )

    expect(result.kind).toBe('external')
    expect(result.target).toBe('lodash')
  })

  it('returns missing kind for non-existent relative imports', () => {
    const dir = createTemporaryDirectory()
    const entryFile = path.join(dir, 'entry.ts')

    fs.writeFileSync(entryFile, "import { x } from './missing.js'\n")

    const result = resolveDependency(
      {
        specifier: './missing.js',
        referenceKind: 'import',
        isTypeOnly: false,
        unused: false,
      },
      entryFile,
      createDefaultOptions(dir),
    )

    expect(result.kind).toBe('missing')
  })

  it('classifies node:fs as builtin', () => {
    const dir = createTemporaryDirectory()
    const entryFile = path.join(dir, 'entry.ts')
    fs.writeFileSync(entryFile, "import fs from 'node:fs'\n")

    const result = resolveDependency(
      {
        specifier: 'node:fs',
        referenceKind: 'import',
        isTypeOnly: false,
        unused: false,
      },
      entryFile,
      createDefaultOptions(dir),
    )

    expect(result.kind).toBe('builtin')
    expect(result.target).toBe('node:fs')
  })

  it('preserves referenceKind and isTypeOnly flags', () => {
    const dir = createTemporaryDirectory()
    const entryFile = path.join(dir, 'entry.ts')
    fs.writeFileSync(entryFile, "import type { X } from 'node:path'\n")

    const result = resolveDependency(
      {
        specifier: 'node:path',
        referenceKind: 'export',
        isTypeOnly: true,
        unused: true,
      },
      entryFile,
      createDefaultOptions(dir),
    )

    expect(result.referenceKind).toBe('export')
    expect(result.isTypeOnly).toBe(true)
    expect(result.unused).toBe(true)
    expect(result.kind).toBe('builtin')
  })

  it('resolves .tsx file imports as source kind', () => {
    const dir = createTemporaryDirectory()
    const entryFile = path.join(dir, 'entry.ts')
    const componentFile = path.join(dir, 'component.tsx')

    fs.writeFileSync(entryFile, "import { App } from './component.js'\n")
    fs.writeFileSync(componentFile, 'export const App = () => null\n')

    const result = resolveDependency(
      {
        specifier: './component.js',
        referenceKind: 'import',
        isTypeOnly: false,
        unused: false,
      },
      entryFile,
      createDefaultOptions(dir),
    )

    expect(result.kind).toBe('source')
    expect(result.target).toBe(componentFile)
  })
})
