import process from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { main } from '../src/app/cli.js'
import { runCli } from '../src/app/run.js'

vi.mock('../src/app/run.js', () => ({
  runCli: vi.fn(),
}))

describe('main', () => {
  const stderrWrite = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation(() => true)
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

  it('prints help through the CLI framework', () => {
    main('1.2.3', ['--help'])

    expect(runCli).not.toHaveBeenCalled()
    expect(consoleInfo).toHaveBeenCalled()
    expect(getConsoleOutput(consoleInfo)).toContain('Usage:')
    expect(getConsoleOutput(consoleInfo)).toContain('$ foresthouse deps')
    expect(getConsoleOutput(consoleInfo)).toContain('$ foresthouse import')
    expect(getConsoleOutput(consoleInfo)).toContain('$ foresthouse react')
    expect(process.exitCode).toBeUndefined()
  })

  it('prints help when no command is provided', () => {
    main('1.2.3', [])

    expect(runCli).not.toHaveBeenCalled()
    expect(consoleInfo).toHaveBeenCalled()
    expect(getConsoleOutput(consoleInfo)).toContain('Usage:')
    expect(getConsoleOutput(consoleInfo)).toContain('$ foresthouse deps')
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
