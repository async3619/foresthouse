import process from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { main } from '../src/app/cli.js'
import { runCli } from '../src/app/run.js'

vi.mock('../src/app/run.js', () => ({
  runCli: vi.fn(),
}))

describe('main', () => {
  const stderrWrite = vi.spyOn(process.stderr, 'write')
  const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})

  beforeEach(() => {
    vi.mocked(runCli).mockReset()
    stderrWrite.mockClear()
    consoleInfo.mockClear()
    process.exitCode = undefined
  })

  afterEach(() => {
    process.exitCode = undefined
  })

  it('passes parsed import options to the CLI runner', () => {
    main('1.2.3', [
      'import',
      'src/main.tsx',
      '--cwd',
      'test/fixtures/react-mode',
      '--config',
      'tsconfig.json',
      '--include-externals',
      '--no-unused',
      '--json',
    ])

    expect(runCli).toHaveBeenCalledWith({
      command: 'import',
      entryFile: 'src/main.tsx',
      cwd: 'test/fixtures/react-mode',
      configPath: 'tsconfig.json',
      includeExternals: true,
      omitUnused: true,
      json: true,
    })
  })

  it('supports import --entry', () => {
    main('1.2.3', ['import', '--entry', 'src/main.tsx'])

    expect(runCli).toHaveBeenCalledWith({
      command: 'import',
      entryFile: 'src/main.tsx',
      cwd: undefined,
      configPath: undefined,
      includeExternals: false,
      omitUnused: false,
      json: false,
    })
  })

  it('passes parsed react options to the CLI runner', () => {
    main('1.2.3', [
      'react',
      'src/main.tsx',
      '--cwd',
      'test/fixtures/react-mode',
      '--config',
      'tsconfig.json',
      '--json',
      '--filter',
      'hook',
    ])

    expect(runCli).toHaveBeenCalledWith({
      command: 'react',
      entryFile: 'src/main.tsx',
      cwd: 'test/fixtures/react-mode',
      configPath: 'tsconfig.json',
      json: true,
      filter: 'hook',
    })
  })

  it('uses all react usages by default', () => {
    main('1.2.3', ['react', 'src/main.tsx'])

    expect(runCli).toHaveBeenCalledWith({
      command: 'react',
      entryFile: 'src/main.tsx',
      cwd: undefined,
      configPath: undefined,
      json: false,
      filter: 'all',
    })
  })

  it('prints help through the CLI framework', () => {
    main('1.2.3', ['--help'])

    expect(runCli).not.toHaveBeenCalled()
    expect(consoleInfo).toHaveBeenCalled()
    expect(getConsoleOutput(consoleInfo)).toContain('Usage:')
    expect(getConsoleOutput(consoleInfo)).toContain('$ foresthouse import')
    expect(getConsoleOutput(consoleInfo)).toContain('$ foresthouse react')
    expect(process.exitCode).toBeUndefined()
  })

  it('prints help when no command is provided', () => {
    main('1.2.3', [])

    expect(runCli).not.toHaveBeenCalled()
    expect(consoleInfo).toHaveBeenCalled()
    expect(getConsoleOutput(consoleInfo)).toContain('Usage:')
    expect(getConsoleOutput(consoleInfo)).toContain('$ foresthouse import')
    expect(getConsoleOutput(consoleInfo)).toContain('$ foresthouse react')
    expect(process.exitCode).toBeUndefined()
  })

  it('prints version through the CLI framework', () => {
    main('1.2.3', ['--version'])

    expect(runCli).not.toHaveBeenCalled()
    expect(getConsoleOutput(consoleInfo)).toContain('foresthouse/1.2.3')
    expect(process.exitCode).toBeUndefined()
  })

  it('reports unknown options as errors', () => {
    main('1.2.3', ['import', 'src/main.ts', '--wat'])

    expect(runCli).not.toHaveBeenCalled()
    expect(stderrWrite).toHaveBeenCalledWith(
      'foresthouse: Unknown option `--wat`\n',
    )
    expect(process.exitCode).toBe(1)
  })

  it('reports missing option values as errors', () => {
    main('1.2.3', ['import', 'src/main.ts', '--cwd'])

    expect(runCli).not.toHaveBeenCalled()
    expect(stderrWrite).toHaveBeenCalledWith(
      'foresthouse: option `--cwd <path>` value is missing\n',
    )
    expect(process.exitCode).toBe(1)
  })

  it('reports a missing import entry', () => {
    main('1.2.3', ['import'])

    expect(runCli).not.toHaveBeenCalled()
    expect(stderrWrite).toHaveBeenCalledWith(
      'foresthouse: Missing import entry file. Use `foresthouse import <entry-file>` or `foresthouse import --entry <path>`.\n',
    )
    expect(process.exitCode).toBe(1)
  })

  it('reports conflicting import entries', () => {
    main('1.2.3', ['import', 'src/main.ts', '--entry', 'src/app.ts'])

    expect(runCli).not.toHaveBeenCalled()
    expect(stderrWrite).toHaveBeenCalledWith(
      'foresthouse: Provide the import entry only once, either as `foresthouse import <entry-file>` or `foresthouse import --entry <path>`.\n',
    )
    expect(process.exitCode).toBe(1)
  })

  it('reports invalid react filter values as errors', () => {
    main('1.2.3', ['react', 'src/main.tsx', '--filter', 'widget'])

    expect(runCli).not.toHaveBeenCalled()
    expect(stderrWrite).toHaveBeenCalledWith(
      'foresthouse: Unknown React filter: widget\n',
    )
    expect(process.exitCode).toBe(1)
  })

  it('rejects the removed --react flag', () => {
    main('1.2.3', ['--react', 'src/main.tsx'])

    expect(runCli).not.toHaveBeenCalled()
    expect(stderrWrite).toHaveBeenCalledWith(
      'foresthouse: Unknown option `--react`\n',
    )
    expect(process.exitCode).toBe(1)
  })

  it('rejects the removed implicit import command form', () => {
    main('1.2.3', ['src/main.tsx'])

    expect(runCli).not.toHaveBeenCalled()
    expect(stderrWrite).toHaveBeenCalledWith(
      'foresthouse: Unknown command `src/main.tsx`\n',
    )
    expect(process.exitCode).toBe(1)
  })
})

function getConsoleOutput(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls
    .flatMap((call: unknown[]) => call.map((value) => String(value)))
    .join('\n')
}
