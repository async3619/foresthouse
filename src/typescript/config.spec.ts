import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ts from 'typescript'
import { afterEach, describe, expect, it } from 'vitest'

import { loadCompilerOptions } from './config.js'

const temporaryDirectories: string[] = []

describe('loadCompilerOptions', () => {
  afterEach(() => {
    temporaryDirectories.splice(0).forEach((directory) => {
      fs.rmSync(directory, { recursive: true, force: true })
    })
  })

  it('exports the tsconfig loader', () => {
    expect(loadCompilerOptions).toBeTypeOf('function')
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
