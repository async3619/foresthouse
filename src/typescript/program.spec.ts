import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createModuleResolutionHost,
  createProgram,
  createSourceFile,
} from './program.js'

describe('typescript program helpers', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'program-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('createSourceFile', () => {
    it('creates a source file from a .ts file', () => {
      const filePath = path.join(tmpDir, 'test.ts')
      fs.writeFileSync(filePath, 'const x = 1')

      const sourceFile = createSourceFile(filePath)
      expect(sourceFile.fileName).toBe(filePath)
      expect(sourceFile.text).toBe('const x = 1')
    })

    it('creates a source file from a .tsx file', () => {
      const filePath = path.join(tmpDir, 'test.tsx')
      fs.writeFileSync(filePath, 'const App = () => <div />')

      const sourceFile = createSourceFile(filePath)
      expect(sourceFile.fileName).toBe(filePath)
    })

    it('creates a source file from a .js file', () => {
      const filePath = path.join(tmpDir, 'test.js')
      fs.writeFileSync(filePath, 'const x = 1')

      const sourceFile = createSourceFile(filePath)
      expect(sourceFile.fileName).toBe(filePath)
    })

    it('creates a source file from a .jsx file', () => {
      const filePath = path.join(tmpDir, 'test.jsx')
      fs.writeFileSync(filePath, 'const App = () => <div />')

      const sourceFile = createSourceFile(filePath)
      expect(sourceFile.fileName).toBe(filePath)
    })

    it('creates a source file from a .json file', () => {
      const filePath = path.join(tmpDir, 'test.json')
      fs.writeFileSync(filePath, '{"key": "value"}')

      const sourceFile = createSourceFile(filePath)
      expect(sourceFile.fileName).toBe(filePath)
    })

    it('creates a source file from a .mjs file', () => {
      const filePath = path.join(tmpDir, 'test.mjs')
      fs.writeFileSync(filePath, 'export const x = 1')

      const sourceFile = createSourceFile(filePath)
      expect(sourceFile.fileName).toBe(filePath)
    })

    it('creates a source file from a .cjs file', () => {
      const filePath = path.join(tmpDir, 'test.cjs')
      fs.writeFileSync(filePath, 'module.exports = 1')

      const sourceFile = createSourceFile(filePath)
      expect(sourceFile.fileName).toBe(filePath)
    })
  })

  describe('createModuleResolutionHost', () => {
    it('returns a host with expected methods', () => {
      const host = createModuleResolutionHost(tmpDir)

      expect(host.fileExists).toBeTypeOf('function')
      expect(host.readFile).toBeTypeOf('function')
      expect(host.getCurrentDirectory).toBeTypeOf('function')
      if (host.getCurrentDirectory) {
        expect(host.getCurrentDirectory()).toBe(tmpDir)
      }
    })

    it('can check file existence', () => {
      const host = createModuleResolutionHost(tmpDir)
      const filePath = path.join(tmpDir, 'exists.ts')
      fs.writeFileSync(filePath, '')

      expect(host.fileExists(filePath)).toBe(true)
      expect(host.fileExists(path.join(tmpDir, 'nope.ts'))).toBe(false)
    })
  })

  describe('createProgram', () => {
    it('creates a TypeScript program from an entry file', () => {
      const filePath = path.join(tmpDir, 'index.ts')
      fs.writeFileSync(filePath, 'export const x: number = 1')

      const program = createProgram(
        filePath,
        { target: 99, module: 99 },
        tmpDir,
      )

      expect(program).toBeDefined()
      expect(program.getSourceFiles().length).toBeGreaterThan(0)
    })
  })
})
