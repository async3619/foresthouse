import process from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./run.js', () => ({ runCli: vi.fn() }))

import { main } from './cli.js'
import { runCli } from './run.js'

const mockedRunCli = vi.mocked(runCli)

describe('main', () => {
  beforeEach(() => {
    mockedRunCli.mockReset()
    process.exitCode = undefined
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  it('dispatches deps command', () => {
    main('1.0.0', ['deps', '.'])

    expect(mockedRunCli).toHaveBeenCalledOnce()
    const opts = mockedRunCli.mock.calls[0] as unknown[]
    const arg = opts[0] as Record<string, unknown>
    expect(arg.command).toBe('deps')
    expect(arg.directory).toBe('.')
  })

  it('dispatches import command', () => {
    main('1.0.0', ['import', 'src/index.ts'])

    expect(mockedRunCli).toHaveBeenCalledOnce()
    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.command).toBe('import')
    expect(arg.entryFile).toBe('src/index.ts')
  })

  it('dispatches react command', () => {
    main('1.0.0', ['react', 'src/App.tsx'])

    expect(mockedRunCli).toHaveBeenCalledOnce()
    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.command).toBe('react')
    expect(arg.entryFile).toBe('src/App.tsx')
  })

  it('uses --entry option for import command', () => {
    main('1.0.0', ['import', '--entry', 'src/index.ts'])

    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.entryFile).toBe('src/index.ts')
  })

  it('passes json flag', () => {
    main('1.0.0', ['deps', '.', '--json'])

    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.json).toBe(true)
  })

  it('passes diff option for deps', () => {
    main('1.0.0', ['deps', '.', '--diff', 'main'])

    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.diff).toBe('main')
  })

  it('accepts react --nextjs without entry file', () => {
    main('1.0.0', ['react', '--nextjs'])

    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.nextjs).toBe(true)
    expect(arg.entryFile).toBeUndefined()
  })

  it('passes react filter option', () => {
    main('1.0.0', ['react', '--filter', 'component', 'src/App.tsx'])

    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.filter).toBe('component')
  })

  it('sets exitCode on invalid react filter', () => {
    main('1.0.0', ['react', '--filter', 'invalid', 'src/App.tsx'])

    expect(process.exitCode).toBe(1)
    expect(mockedRunCli).not.toHaveBeenCalled()
  })

  it('sets exitCode on unknown command', () => {
    main('1.0.0', ['unknown-command'])

    expect(process.exitCode).toBe(1)
    expect(mockedRunCli).not.toHaveBeenCalled()
  })

  it('outputs help with no arguments', () => {
    main('1.0.0', [])

    expect(mockedRunCli).not.toHaveBeenCalled()
  })

  it('sets exitCode on missing import entry', () => {
    main('1.0.0', ['import'])

    expect(process.exitCode).toBe(1)
  })

  it('sets exitCode on missing react entry without nextjs', () => {
    main('1.0.0', ['react'])

    expect(process.exitCode).toBe(1)
  })

  it('sets exitCode on --react typo', () => {
    main('1.0.0', ['--react'])

    expect(process.exitCode).toBe(1)
  })

  it('sets exitCode on conflicting import entries', () => {
    main('1.0.0', ['import', 'a.ts', '--entry', 'b.ts'])

    expect(process.exitCode).toBe(1)
  })

  it('passes --builtin flag for react', () => {
    main('1.0.0', ['react', '--builtin', 'src/App.tsx'])

    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.includeBuiltins).toBe(true)
  })

  it('passes --no-workspaces as expandWorkspaces=false', () => {
    main('1.0.0', ['import', '--no-workspaces', 'src/index.ts'])

    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.expandWorkspaces).toBe(false)
  })

  it('passes --project-only flag', () => {
    main('1.0.0', ['import', 'src/index.ts', '--project-only'])

    expect(mockedRunCli).toHaveBeenCalledOnce()
    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.projectOnly).toBe(true)
  })

  it('passes --cwd option for import', () => {
    main('1.0.0', ['import', '--cwd', '/custom', 'src/index.ts'])

    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.cwd).toBe('/custom')
  })

  it('passes --config option', () => {
    main('1.0.0', ['import', '--config', 'tsconfig.app.json', 'src/index.ts'])

    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.configPath).toBe('tsconfig.app.json')
  })

  it('passes --diff option for react', () => {
    main('1.0.0', ['react', '--diff', 'HEAD~1', 'src/App.tsx'])

    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.diff).toBe('HEAD~1')
  })

  it('passes --unused flag for import', () => {
    main('1.0.0', ['import', '--unused', 'src/index.ts'])

    const arg = (mockedRunCli.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >
    expect(arg.omitUnused).toBe(false)
  })

  it('accepts same positional and --entry value', () => {
    main('1.0.0', ['import', 'src/index.ts', '--entry', 'src/index.ts'])

    expect(mockedRunCli).toHaveBeenCalledOnce()
  })
})
