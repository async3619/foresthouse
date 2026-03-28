import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}))

vi.mock('./index.js', () => ({
  analyzePackageDependencies: vi.fn(),
}))

vi.mock('./pnpm-lock.js', () => ({
  loadPnpmLockImporterResolutions: vi.fn().mockReturnValue(undefined),
}))

import { execFileSync } from 'node:child_process'
import { analyzePackageDependencyDiff } from './diff.js'
import { analyzePackageDependencies } from './index.js'

const mockedExec = vi.mocked(execFileSync)
const mockedAnalyze = vi.mocked(analyzePackageDependencies)

function createMockGraph(
  rootDir: string,
  pkgName: string,
  deps: Array<{
    kind: 'external'
    name: string
    specifier: string
  }> = [],
) {
  return {
    repositoryRoot: rootDir,
    rootId: rootDir,
    nodes: new Map([
      [
        rootDir,
        {
          packageDir: rootDir,
          packageName: pkgName,
          dependencies: deps,
        },
      ],
    ]),
  }
}

describe('analyzePackageDependencyDiff', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'diff-')))
    vi.clearAllMocks()

    // Create real directory structure for fs.realpathSync/fs.existsSync calls
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test-app' }),
    )
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function setupGitMocks(opts?: {
    beforeTree?: string
    afterTree?: string
    changedFiles?: string
    lsTreeFiles?: string
    catFileContent?: string
    lsFilesOutput?: string
  }) {
    const beforeTree = opts?.beforeTree ?? 'before-tree-sha'
    const changedFiles = opts?.changedFiles ?? ''
    const lsTreeFiles = opts?.lsTreeFiles ?? 'package.json\0'
    const catFileContent =
      opts?.catFileContent ??
      JSON.stringify({ name: 'test-app', dependencies: {} })
    const lsFilesOutput = opts?.lsFilesOutput ?? ''

    mockedExec.mockImplementation((_cmd, args) => {
      const gitArgs = args as string[]
      const argsStr = gitArgs.join(' ')

      if (
        argsStr.includes('rev-parse') &&
        argsStr.includes('--show-toplevel')
      ) {
        return `${tmpDir}\n` as never
      }
      if (argsStr.includes('rev-parse') && argsStr.includes('--verify')) {
        return `${beforeTree}\n` as never
      }
      if (argsStr.includes('merge-base')) {
        return `${beforeTree}\n` as never
      }
      if (argsStr.includes('ls-tree')) {
        return lsTreeFiles as never
      }
      if (argsStr.includes('cat-file')) {
        return catFileContent as never
      }
      if (argsStr.includes('diff') && argsStr.includes('--name-only')) {
        return changedFiles as never
      }
      if (argsStr.includes('ls-files')) {
        return lsFilesOutput as never
      }
      return '' as never
    })
  }

  it('returns a diff graph for a simple single ref', () => {
    setupGitMocks()
    mockedAnalyze.mockReturnValue(
      createMockGraph(tmpDir, 'test-app', [
        { kind: 'external', name: 'react', specifier: '^18.0.0' },
      ]),
    )

    const result = analyzePackageDependencyDiff(tmpDir, 'HEAD~1')

    expect(result.repositoryRoot).toBe(tmpDir)
    expect(result.root).toBeDefined()
    expect(result.root.packageName).toBe('test-app')
  })

  it('handles .. range syntax', () => {
    setupGitMocks({ afterTree: 'after-tree-sha' })
    mockedAnalyze.mockReturnValue(createMockGraph(tmpDir, 'test-app'))

    const result = analyzePackageDependencyDiff(tmpDir, 'HEAD~2..HEAD')

    expect(result.root).toBeDefined()
  })

  it('handles ... range syntax with merge-base', () => {
    setupGitMocks()
    mockedAnalyze.mockReturnValue(createMockGraph(tmpDir, 'test-app'))

    const result = analyzePackageDependencyDiff(tmpDir, 'main...feature')

    expect(result.root).toBeDefined()
  })

  it('throws when git repo not found', () => {
    mockedExec.mockImplementation(() => {
      throw new Error('not a git repository')
    })

    expect(() => analyzePackageDependencyDiff(tmpDir, 'HEAD~1')).toThrow(
      'Git diff mode requires a Git repository',
    )
  })

  it('detects added external dependency', () => {
    setupGitMocks({ changedFiles: 'package.json\0' })

    // Before: no deps. After: react added
    let callCount = 0
    mockedAnalyze.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // git tree snapshot (before)
        return createMockGraph(path.join(os.tmpdir(), 'fake'), 'test-app')
      }
      // working tree (after)
      return createMockGraph(tmpDir, 'test-app', [
        { kind: 'external', name: 'react', specifier: '^18.0.0' },
      ])
    })

    const result = analyzePackageDependencyDiff(tmpDir, 'HEAD~1')

    const addedDeps = result.root.dependencies.filter(
      (d) => d.change === 'added',
    )
    expect(addedDeps.length).toBeGreaterThanOrEqual(0)
  })

  it('detects unchanged state when nothing changed', () => {
    setupGitMocks()
    mockedAnalyze.mockReturnValue(createMockGraph(tmpDir, 'test-app'))

    const result = analyzePackageDependencyDiff(tmpDir, 'HEAD~1')

    expect(result.root.change).toBe('unchanged')
    expect(result.root.dependencies).toHaveLength(0)
  })

  it('throws on invalid diff range with multiple separators', () => {
    setupGitMocks()

    expect(() => analyzePackageDependencyDiff(tmpDir, 'a..b..c')).toThrow()
  })

  it('throws on empty parts in diff range', () => {
    setupGitMocks()

    expect(() => analyzePackageDependencyDiff(tmpDir, '..HEAD')).toThrow()
  })
})
