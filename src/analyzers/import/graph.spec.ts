import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('buildDependencyGraph', () => {
  it('exports a callable graph builder', async () => {
    const { buildDependencyGraph } = await import('./graph.js')
    expect(buildDependencyGraph).toBeTypeOf('function')
  })

  it('builds a graph without TypeScript program creation', async () => {
    const fixtureDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'foresthouse-import-graph-'),
    )
    const entryPath = path.join(fixtureDir, 'entry.ts')

    fs.writeFileSync(entryPath, "import './dependency'\n")
    fs.writeFileSync(
      path.join(fixtureDir, 'dependency.ts'),
      'export const dependency = 1\n',
    )

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

      expect(nodes.has(entryPath)).toBe(true)
      expect(nodes.size).toBeGreaterThan(0)
    } finally {
      fs.rmSync(fixtureDir, { force: true, recursive: true })
    }
  })
})
