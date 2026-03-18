import { describe, expect, it, vi } from 'vitest'

import { runCli } from './run.js'

vi.mock('../commands/deps.js', () => ({
  DepsCommand: vi.fn().mockImplementation(() => ({ run: vi.fn() })),
}))

describe('runCli', () => {
  it('exports a callable CLI dispatcher', () => {
    expect(runCli).toBeTypeOf('function')
  })
})
