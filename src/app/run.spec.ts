import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockDepsRun = vi.fn()
const mockImportRun = vi.fn()
const mockReactRun = vi.fn()

vi.mock('../commands/deps.js', () => {
  return {
    DepsCommand: class {
      run = mockDepsRun
    },
  }
})
vi.mock('../commands/import.js', () => {
  return {
    ImportCommand: class {
      run = mockImportRun
    },
  }
})
vi.mock('../commands/react.js', () => {
  return {
    ReactCommand: class {
      run = mockReactRun
    },
  }
})

import type { CliOptions } from './args.js'
import { runCli } from './run.js'

describe('runCli', () => {
  beforeEach(() => {
    mockDepsRun.mockReset()
    mockImportRun.mockReset()
    mockReactRun.mockReset()
  })

  it('dispatches to DepsCommand for deps command', () => {
    runCli({
      command: 'deps',
      directory: '.',
      diff: undefined,
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: false,
    })

    expect(mockDepsRun).toHaveBeenCalledOnce()
  })

  it('dispatches to ImportCommand for import command', () => {
    runCli({
      command: 'import',
      entryFile: 'src/index.ts',
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      includeExternals: false,
      omitUnused: true,
      json: false,
    })

    expect(mockImportRun).toHaveBeenCalledOnce()
  })

  it('dispatches to ReactCommand for react command', () => {
    runCli({
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
    } as CliOptions)

    expect(mockReactRun).toHaveBeenCalledOnce()
  })
})
