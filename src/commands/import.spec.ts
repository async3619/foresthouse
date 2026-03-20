import { describe, expect, it, vi } from 'vitest'

import { analyzeDependencies } from '../analyzers/import/index.js'
import { ImportCommand } from './import.js'

vi.mock('../analyzers/import/index.js', () => ({
  analyzeDependencies: vi.fn(),
}))

describe('ImportCommand', () => {
  it('exports the import command class', () => {
    expect(ImportCommand).toBeTypeOf('function')
  })

  it('skips unused import tracking when unused output is omitted', () => {
    vi.mocked(analyzeDependencies).mockReturnValue({
      cwd: '/repo',
      entryId: '/repo/src/main.ts',
      nodes: new Map(),
    })

    new ImportCommand({
      command: 'import',
      entryFile: 'src/main.ts',
      cwd: '/repo',
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      includeExternals: false,
      omitUnused: true,
      json: false,
    }).run()

    expect(analyzeDependencies).toHaveBeenCalledWith('src/main.ts', {
      cwd: '/repo',
      expandWorkspaces: true,
      projectOnly: false,
      trackUnusedImports: false,
    })
  })
})
