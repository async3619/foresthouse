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

  it('passes parsed options to the CLI runner', () => {
    main('1.2.3', [
      'src/main.tsx',
      '--cwd',
      'test/fixtures/react-mode',
      '--config',
      'tsconfig.json',
      '--include-externals',
      '--no-unused',
      '--json',
      '--react=hook',
    ])

    expect(runCli).toHaveBeenCalledWith({
      entryFile: 'src/main.tsx',
      cwd: 'test/fixtures/react-mode',
      configPath: 'tsconfig.json',
      includeExternals: true,
      omitUnused: true,
      json: true,
      react: 'hook',
    })
  })

  it('treats --react without a value as all react usages', () => {
    main('1.2.3', ['src/main.tsx', '--react'])

    expect(runCli).toHaveBeenCalledWith(
      expect.objectContaining({
        entryFile: 'src/main.tsx',
        react: 'all',
      }),
    )
  })

  it('prints help through the CLI framework', () => {
    main('1.2.3', ['--help'])

    expect(runCli).not.toHaveBeenCalled()
    expect(consoleInfo).toHaveBeenCalled()
    expect(getConsoleOutput(consoleInfo)).toContain('Usage:')
    expect(getConsoleOutput(consoleInfo)).toContain(
      '$ foresthouse <entry-file>',
    )
    expect(process.exitCode).toBeUndefined()
  })

  it('prints version through the CLI framework', () => {
    main('1.2.3', ['--version'])

    expect(runCli).not.toHaveBeenCalled()
    expect(getConsoleOutput(consoleInfo)).toContain('foresthouse/1.2.3')
    expect(process.exitCode).toBeUndefined()
  })

  it('reports unknown options as errors', () => {
    main('1.2.3', ['src/main.ts', '--wat'])

    expect(runCli).not.toHaveBeenCalled()
    expect(stderrWrite).toHaveBeenCalledWith(
      'foresthouse: Unknown option `--wat`\n',
    )
    expect(process.exitCode).toBe(1)
  })

  it('reports missing option values as errors', () => {
    main('1.2.3', ['src/main.ts', '--cwd'])

    expect(runCli).not.toHaveBeenCalled()
    expect(stderrWrite).toHaveBeenCalledWith(
      'foresthouse: option `--cwd <path>` value is missing\n',
    )
    expect(process.exitCode).toBe(1)
  })

  it('reports invalid react filter values as errors', () => {
    main('1.2.3', ['src/main.tsx', '--react=widget'])

    expect(runCli).not.toHaveBeenCalled()
    expect(stderrWrite).toHaveBeenCalledWith(
      'foresthouse: Unknown React mode: widget\n',
    )
    expect(process.exitCode).toBe(1)
  })
})

function getConsoleOutput(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls
    .flatMap((call: unknown[]) => call.map((value) => String(value)))
    .join('\n')
}
