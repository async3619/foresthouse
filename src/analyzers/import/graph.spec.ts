import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { createProgramMock } = vi.hoisted(() => ({
  createProgramMock: vi.fn(),
}))

vi.mock('../../typescript/program.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../typescript/program.js')
  >('../../typescript/program.js')

  return {
    ...actual,
    createProgram: createProgramMock,
  }
})

describe('buildDependencyGraph', () => {
  afterEach(() => {
    createProgramMock.mockReset()
  })

  it('exports a callable graph builder', async () => {
    const { buildDependencyGraph } = await import('./graph.js')
    expect(buildDependencyGraph).toBeTypeOf('function')
  })

  it('skips TypeScript program creation when unused import tracking is disabled', async () => {
    const fixtureDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'foresthouse-import-graph-'),
    )
    const entryPath = path.join(fixtureDir, 'entry.ts')

    fs.writeFileSync(entryPath, "import './dependency'\n")
    fs.writeFileSync(
      path.join(fixtureDir, 'dependency.ts'),
      'export const dependency = 1\n',
    )

    createProgramMock.mockImplementation(() => {
      throw new Error('createProgram should not be called')
    })

    const { buildDependencyGraph } = await import('./graph.js')

    try {
      const nodes = buildDependencyGraph(
        [
          {
            entryPath,
            compilerOptions: {},
          },
        ],
        {
          cwd: fixtureDir,
          expandWorkspaces: true,
          projectOnly: false,
          trackUnusedImports: false,
        },
      )

      expect(createProgramMock).not.toHaveBeenCalled()
      expect(nodes.has(entryPath)).toBe(true)
      expect(nodes.size).toBeGreaterThan(0)
    } finally {
      fs.rmSync(fixtureDir, { force: true, recursive: true })
    }
  })
})
