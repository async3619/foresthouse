import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../analyzers/react/index.js', () => ({
  analyzeReactUsage: vi.fn().mockReturnValue({
    cwd: '/project',
    entryId: '/project/src/App.tsx',
    entryIds: ['/project/src/App.tsx'],
    nodes: new Map(),
    entries: [],
  }),
}))
vi.mock('../analyzers/react/diff.js', () => ({
  analyzeReactUsageDiff: vi.fn().mockReturnValue({
    kind: 'react-usage-diff',
    repositoryRoot: '/repo',
    cwd: '/project',
    entries: [],
    roots: [],
  }),
}))
vi.mock('../app/react-entry-files.js', () => ({
  resolveReactEntryFiles: vi.fn().mockReturnValue('/project/src/App.tsx'),
}))

import { ReactCommand } from './react.js'

describe('ReactCommand', () => {
  let stdoutOutput: string

  beforeEach(() => {
    stdoutOutput = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutOutput += String(chunk)
      return true
    })
  })

  it('runs analysis and renders ascii output', () => {
    const cmd = new ReactCommand({
      command: 'react',
      entryFile: 'src/App.tsx',
      diff: undefined,
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: false,
      filter: 'all',
      nextjs: false,
      includeBuiltins: false,
    })

    cmd.run()
    expect(stdoutOutput).toContain('No React symbols found.')
  })

  it('outputs JSON when json flag is set', () => {
    const cmd = new ReactCommand({
      command: 'react',
      entryFile: 'src/App.tsx',
      diff: undefined,
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: true,
      filter: 'all',
      nextjs: false,
      includeBuiltins: false,
    })

    cmd.run()
    const parsed = JSON.parse(stdoutOutput)
    expect(parsed.kind).toBe('react-usage')
  })

  it('runs diff analysis when diff option is provided', () => {
    const cmd = new ReactCommand({
      command: 'react',
      entryFile: 'src/App.tsx',
      diff: 'main',
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: false,
      filter: 'all',
      nextjs: false,
      includeBuiltins: false,
    })

    cmd.run()
    expect(stdoutOutput).toContain('No React changes found.')
  })

  it('outputs diff as JSON', () => {
    const cmd = new ReactCommand({
      command: 'react',
      entryFile: 'src/App.tsx',
      diff: 'main',
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: true,
      filter: 'all',
      nextjs: false,
      includeBuiltins: false,
    })

    cmd.run()
    const parsed = JSON.parse(stdoutOutput)
    expect(parsed.kind).toBe('react-usage-diff')
  })
})
