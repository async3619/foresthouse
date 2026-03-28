import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../analyzers/deps/index.js', () => ({
  analyzePackageDependencies: vi.fn().mockReturnValue({
    repositoryRoot: '/repo',
    rootId: '/repo',
    nodes: new Map([
      [
        '/repo',
        {
          packageDir: '/repo',
          packageName: 'test-app',
          dependencies: [],
        },
      ],
    ]),
  }),
}))
vi.mock('../analyzers/deps/diff.js', () => ({
  analyzePackageDependencyDiff: vi.fn().mockReturnValue({
    repositoryRoot: '/repo',
    root: {
      kind: 'root',
      label: 'test-app',
      packageName: 'test-app',
      path: '.',
      change: 'unchanged',
      dependencies: [],
    },
  }),
}))

import { DepsCommand } from './deps.js'

describe('DepsCommand', () => {
  let stdoutOutput: string

  beforeEach(() => {
    stdoutOutput = ''
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutOutput += String(chunk)
      return true
    })
  })

  it('runs analysis and renders ascii output', () => {
    const cmd = new DepsCommand({
      command: 'deps',
      directory: '.',
      diff: undefined,
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: false,
    })

    cmd.run()
    expect(stdoutOutput).toContain('test-app')
  })

  it('outputs JSON when json flag is set', () => {
    const cmd = new DepsCommand({
      command: 'deps',
      directory: '.',
      diff: undefined,
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: true,
    })

    cmd.run()
    const parsed = JSON.parse(stdoutOutput)
    expect(parsed.kind).toBe('root')
    expect(parsed.packageName).toBe('test-app')
  })

  it('runs diff analysis when diff option is provided', () => {
    const cmd = new DepsCommand({
      command: 'deps',
      directory: '.',
      diff: 'main',
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: false,
    })

    cmd.run()
    expect(stdoutOutput).toContain('test-app')
  })

  it('outputs diff as JSON', () => {
    const cmd = new DepsCommand({
      command: 'deps',
      directory: '.',
      diff: 'main',
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: true,
    })

    cmd.run()
    const parsed = JSON.parse(stdoutOutput)
    expect(parsed.kind).toBe('root')
  })
})
