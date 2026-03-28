import { describe, expect, it, vi } from 'vitest'

import { analyzeDependencies } from '../analyzers/import/index.js'
import type { DependencyEdge } from '../types/dependency-edge.js'
import type { SourceModuleNode } from '../types/source-module-node.js'
import { ImportCommand } from './import.js'

vi.mock('../analyzers/import/index.js', () => ({
  analyzeDependencies: vi.fn(),
}))

function createMockGraph(overrides?: {
  cwd?: string
  entryId?: string
  nodes?: Map<string, SourceModuleNode>
}) {
  const defaultNodes = new Map<string, SourceModuleNode>([
    [
      '/repo/src/main.ts',
      {
        id: '/repo/src/main.ts',
        dependencies: [] as readonly DependencyEdge[],
      },
    ],
  ])
  return {
    cwd: overrides?.cwd ?? '/repo',
    entryId: overrides?.entryId ?? '/repo/src/main.ts',
    nodes: overrides?.nodes ?? defaultNodes,
  }
}

describe('ImportCommand', () => {
  it('exports the import command class', () => {
    expect(ImportCommand).toBeTypeOf('function')
  })

  it('skips unused import tracking when unused output is omitted', () => {
    vi.mocked(analyzeDependencies).mockReturnValue(createMockGraph())

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

  it('renders ascii tree output', () => {
    vi.mocked(analyzeDependencies).mockReturnValue(createMockGraph())

    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)

    try {
      new ImportCommand({
        command: 'import',
        entryFile: 'src/main.ts',
        cwd: '/repo',
        configPath: undefined,
        expandWorkspaces: true,
        projectOnly: false,
        includeExternals: false,
        omitUnused: false,
        json: false,
      }).run()

      expect(writeSpy).toHaveBeenCalled()
      const output = writeSpy.mock.calls[0]?.[0]
      expect(typeof output).toBe('string')
      expect(output as string).toContain('main.ts')
    } finally {
      writeSpy.mockRestore()
    }
  })

  it('outputs JSON when json flag is set', () => {
    vi.mocked(analyzeDependencies).mockReturnValue(createMockGraph())

    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)

    try {
      new ImportCommand({
        command: 'import',
        entryFile: 'src/main.ts',
        cwd: '/repo',
        configPath: undefined,
        expandWorkspaces: true,
        projectOnly: false,
        includeExternals: false,
        omitUnused: false,
        json: true,
      }).run()

      expect(writeSpy).toHaveBeenCalled()
      const output = writeSpy.mock.calls[0]?.[0] as string
      const parsed = JSON.parse(output)
      expect(parsed).toHaveProperty('path')
      expect(parsed).toHaveProperty('kind')
    } finally {
      writeSpy.mockRestore()
    }
  })

  it('passes includeExternals option to render', () => {
    const nodesMap = new Map<string, SourceModuleNode>([
      [
        '/repo/src/main.ts',
        {
          id: '/repo/src/main.ts',
          dependencies: [
            {
              specifier: 'lodash',
              referenceKind: 'import' as const,
              isTypeOnly: false,
              unused: false,
              kind: 'external' as const,
              target: 'lodash',
            },
          ],
        },
      ],
    ])

    vi.mocked(analyzeDependencies).mockReturnValue(
      createMockGraph({ nodes: nodesMap }),
    )

    const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true)

    try {
      new ImportCommand({
        command: 'import',
        entryFile: 'src/main.ts',
        cwd: '/repo',
        configPath: undefined,
        expandWorkspaces: true,
        projectOnly: false,
        includeExternals: true,
        omitUnused: false,
        json: false,
      }).run()

      expect(writeSpy).toHaveBeenCalled()
      const output = writeSpy.mock.calls[0]?.[0] as string
      expect(output).toContain('lodash')
    } finally {
      writeSpy.mockRestore()
    }
  })

  it('passes omitUnused option', () => {
    vi.mocked(analyzeDependencies).mockReturnValue(createMockGraph())

    new ImportCommand({
      command: 'import',
      entryFile: 'src/main.ts',
      cwd: '/repo',
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      includeExternals: false,
      omitUnused: false,
      json: false,
    }).run()

    expect(analyzeDependencies).toHaveBeenCalledWith('src/main.ts', {
      cwd: '/repo',
      expandWorkspaces: true,
      projectOnly: false,
      trackUnusedImports: true,
    })
  })

  it('enables unused import tracking when omitUnused is false', () => {
    vi.mocked(analyzeDependencies).mockReturnValue(createMockGraph())

    new ImportCommand({
      command: 'import',
      entryFile: 'src/main.ts',
      cwd: '/repo',
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      includeExternals: false,
      omitUnused: false,
      json: false,
    }).run()

    expect(analyzeDependencies).toHaveBeenCalledWith(
      'src/main.ts',
      expect.objectContaining({
        trackUnusedImports: true,
      }),
    )
  })
})
