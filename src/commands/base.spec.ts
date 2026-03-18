import { describe, expect, it, vi } from 'vitest'

import { BaseCommand } from './base.js'

describe('BaseCommand', () => {
  it('renders serialized output in json mode', () => {
    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)

    class TestCommand extends BaseCommand<string> {
      protected analyze(): string {
        return 'graph'
      }
      protected serialize(): object {
        return { ok: true }
      }
      protected render(): string {
        return 'rendered'
      }
    }

    new TestCommand({
      command: 'deps',
      directory: '.',
      diff: undefined,
      cwd: undefined,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: true,
    }).run()

    expect(stdoutWrite).toHaveBeenCalledWith('{\n  "ok": true\n}\n')
    stdoutWrite.mockRestore()
  })
})
