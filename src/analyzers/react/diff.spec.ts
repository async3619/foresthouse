import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
  execSync: vi.fn(),
}))

vi.mock('./index.js', () => ({
  analyzeReactUsage: vi.fn(),
}))

vi.mock('../../app/react-entry-files.js', () => ({
  resolveReactEntryFiles: vi.fn().mockReturnValue('/project/src/App.tsx'),
}))

import { execFileSync } from 'node:child_process'
import type { ReactCliOptions } from '../../app/args.js'
import { analyzeReactUsageDiff } from './diff.js'
import { analyzeReactUsage } from './index.js'

const mockedExec = vi.mocked(execFileSync)
const mockedAnalyze = vi.mocked(analyzeReactUsage)

function createMockReactGraph(cwd: string, hasNodes = true) {
  const nodes = hasNodes
    ? new Map([
        [
          `${cwd}/src/App.tsx#component:App`,
          {
            id: `${cwd}/src/App.tsx#component:App`,
            name: 'App',
            kind: 'component' as const,
            filePath: `${cwd}/src/App.tsx`,
            exportNames: ['default'],
            usages: [],
          },
        ],
      ])
    : new Map()

  return {
    cwd,
    entryId: `${cwd}/src/App.tsx`,
    entryIds: [`${cwd}/src/App.tsx`],
    nodes,
    entries: [],
  }
}

function createBaseOptions(tmpDir: string): ReactCliOptions {
  return {
    command: 'react',
    entryFile: 'src/App.tsx',
    diff: 'HEAD~1',
    cwd: tmpDir,
    configPath: undefined,
    expandWorkspaces: true,
    projectOnly: false,
    json: false,
    filter: 'all',
    nextjs: false,
    includeBuiltins: false,
  }
}

describe('analyzeReactUsageDiff', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rdiff-')))
    vi.clearAllMocks()

    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'App.tsx'),
      'export function App() { return <div /> }',
    )
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function setupGitMocks() {
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
        return 'abc123tree\n' as never
      }
      if (argsStr.includes('merge-base')) {
        return 'mergebase123\n' as never
      }
      if (argsStr.includes('ls-tree')) {
        return 'src/App.tsx\0' as never
      }
      if (argsStr.includes('cat-file')) {
        return 'export function App() { return <div /> }' as never
      }
      if (argsStr.includes('diff') && argsStr.includes('--name-only')) {
        return 'src/App.tsx\0' as never
      }
      if (argsStr.includes('ls-files')) {
        return '' as never
      }
      return '' as never
    })
  }

  it('returns a diff graph for a simple ref', () => {
    setupGitMocks()
    mockedAnalyze.mockReturnValue(createMockReactGraph(tmpDir))

    const result = analyzeReactUsageDiff(createBaseOptions(tmpDir))

    expect(result.kind).toBe('react-usage-diff')
    expect(result.repositoryRoot).toBe(tmpDir)
  })

  it('throws when not in a git repository', () => {
    mockedExec.mockImplementation(() => {
      throw new Error('not a git repository')
    })

    expect(() => analyzeReactUsageDiff(createBaseOptions(tmpDir))).toThrow(
      'Git diff mode requires a Git repository',
    )
  })

  it('throws on invalid ... range with empty parts', () => {
    setupGitMocks()

    const opts = createBaseOptions(tmpDir)
    expect(() => analyzeReactUsageDiff({ ...opts, diff: '...HEAD' })).toThrow()
  })

  it('throws on invalid .. range with empty parts', () => {
    setupGitMocks()

    const opts = createBaseOptions(tmpDir)
    expect(() => analyzeReactUsageDiff({ ...opts, diff: '..HEAD' })).toThrow()
  })
})
