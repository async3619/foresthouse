import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ts from 'typescript'
import { afterEach, describe, expect, it } from 'vitest'

import { loadCompilerOptions } from './config.js'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true })
  })
})

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'foresthouse-config-spec-'),
  )
  temporaryDirectories.push(directory)
  return directory
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

describe('loadCompilerOptions', () => {
  it('exports the tsconfig loader', () => {
    expect(loadCompilerOptions).toBeTypeOf('function')
  })

  it('loads tsconfig.json from a directory', () => {
    const dir = createTemporaryDirectory()
    writeJson(path.join(dir, 'tsconfig.json'), {
      compilerOptions: {
        strict: true,
        target: 'ES2022',
      },
    })
    fs.writeFileSync(path.join(dir, 'index.ts'), 'export {}\n')

    const loaded = loadCompilerOptions(dir)

    expect(loaded.path).toBe(path.join(dir, 'tsconfig.json'))
    expect(loaded.compilerOptions.strict).toBe(true)
  })

  it('handles extends in tsconfig', () => {
    const dir = createTemporaryDirectory()
    writeJson(path.join(dir, 'tsconfig.base.json'), {
      compilerOptions: {
        strict: true,
        target: 'ES2022',
      },
    })
    writeJson(path.join(dir, 'tsconfig.json'), {
      extends: './tsconfig.base.json',
      compilerOptions: {
        outDir: './dist',
      },
    })
    fs.writeFileSync(path.join(dir, 'index.ts'), 'export {}\n')

    const loaded = loadCompilerOptions(dir)

    expect(loaded.path).toBe(path.join(dir, 'tsconfig.json'))
    expect(loaded.compilerOptions.strict).toBe(true)
    expect(loaded.compilerOptions.outDir).toBeDefined()
  })

  it('returns default options when no tsconfig is found', () => {
    const dir = createTemporaryDirectory()
    // Create a deeply nested dir so it won't pick up any parent tsconfig
    const nested = path.join(dir, 'a', 'b', 'c', 'd', 'e')
    fs.mkdirSync(nested, { recursive: true })

    const loaded = loadCompilerOptions(nested)

    // When no config is found, path should be undefined
    expect(loaded.path).toBeUndefined()
    // Should return default compiler options
    expect(loaded.compilerOptions).toBeDefined()
    expect(loaded.compilerOptions.allowJs).toBe(true)
  })

  it('uses explicit configPath when provided', () => {
    const dir = createTemporaryDirectory()
    fs.writeFileSync(path.join(dir, 'index.ts'), 'export {}\n')
    writeJson(path.join(dir, 'tsconfig.json'), {
      compilerOptions: {
        strict: false,
      },
    })
    writeJson(path.join(dir, 'tsconfig.custom.json'), {
      compilerOptions: {
        strict: true,
        target: 'ES2020',
      },
    })

    const loaded = loadCompilerOptions(dir, 'tsconfig.custom.json')

    expect(loaded.path).toBe(path.join(dir, 'tsconfig.custom.json'))
    expect(loaded.compilerOptions.strict).toBe(true)
  })

  it('handles jsconfig.json', () => {
    const dir = createTemporaryDirectory()
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = {}\n')
    writeJson(path.join(dir, 'jsconfig.json'), {
      compilerOptions: {
        target: 'ES2020',
        checkJs: true,
      },
    })

    const loaded = loadCompilerOptions(dir)

    expect(loaded.path).toBe(path.join(dir, 'jsconfig.json'))
    expect(loaded.compilerOptions.checkJs).toBe(true)
  })

  it('reuses parsed compiler options for repeated lookups under the same config', () => {
    const projectDir = createTemporaryDirectory()
    const srcDir = path.join(projectDir, 'src', 'nested')
    fs.mkdirSync(srcDir, { recursive: true })
    writeJson(path.join(projectDir, 'tsconfig.json'), {
      compilerOptions: {
        strict: true,
        target: 'ES2022',
      },
    })
    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export {}\n')

    const firstLoaded = loadCompilerOptions(srcDir)
    const secondLoaded = loadCompilerOptions(path.join(projectDir, 'src'))

    expect(firstLoaded.path).toBe(path.join(projectDir, 'tsconfig.json'))
    expect(secondLoaded.path).toBe(path.join(projectDir, 'tsconfig.json'))
    expect(secondLoaded).toBe(firstLoaded)
  })

  it('resolves package-based extends from sibling workspace packages', () => {
    const workspaceRoot = createTemporaryDirectory()
    writeJson(path.join(workspaceRoot, 'package.json'), {
      private: true,
      workspaces: ['packages/*'],
    })
    fs.writeFileSync(
      path.join(workspaceRoot, 'pnpm-workspace.yaml'),
      ['packages:', '  - packages/*'].join('\n'),
    )

    const sharedConfigDir = path.join(workspaceRoot, 'packages', 'tsconfig')
    fs.mkdirSync(sharedConfigDir, { recursive: true })
    writeJson(path.join(sharedConfigDir, 'package.json'), {
      name: 'tsconfig',
      version: '1.0.0',
    })
    writeJson(path.join(sharedConfigDir, 'base.json'), {
      compilerOptions: {
        strict: true,
        target: 'ES2022',
      },
    })
    writeJson(path.join(sharedConfigDir, 'react-library.json'), {
      extends: './base.json',
      compilerOptions: {
        jsx: 'react-jsx',
      },
    })

    const packageDir = path.join(workspaceRoot, 'packages', 'icons')
    fs.mkdirSync(path.join(packageDir, 'src'), { recursive: true })
    writeJson(path.join(packageDir, 'package.json'), {
      name: 'icons',
      version: '1.0.0',
    })
    writeJson(path.join(packageDir, 'tsconfig.json'), {
      extends: 'tsconfig/react-library.json',
      include: ['src'],
    })
    fs.writeFileSync(
      path.join(packageDir, 'src', 'index.tsx'),
      'export const Icon = () => null\n',
    )

    const loaded = loadCompilerOptions(packageDir)

    expect(loaded.path).toBe(path.join(packageDir, 'tsconfig.json'))
    expect(loaded.compilerOptions.strict).toBe(true)
    expect(loaded.compilerOptions.jsx).toBe(ts.JsxEmit.ReactJSX)
  })

  it('prefers tsconfig.json over jsconfig.json when both exist', () => {
    const dir = createTemporaryDirectory()
    fs.writeFileSync(path.join(dir, 'index.ts'), 'export {}\n')
    writeJson(path.join(dir, 'tsconfig.json'), {
      compilerOptions: {
        strict: true,
      },
    })
    writeJson(path.join(dir, 'jsconfig.json'), {
      compilerOptions: {
        checkJs: true,
      },
    })

    const loaded = loadCompilerOptions(dir)

    expect(loaded.path).toBe(path.join(dir, 'tsconfig.json'))
    expect(loaded.compilerOptions.strict).toBe(true)
  })
})
