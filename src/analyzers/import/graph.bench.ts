import path from 'node:path'

import { bench, describe } from 'vitest'

import { loadCompilerOptions } from '../../typescript/config.js'
import { resolveExistingPath } from './entry.js'
import { buildDependencyGraph, type EntryConfig } from './graph.js'

const fixturesDir = path.resolve(import.meta.dirname, '../../../test/fixtures')
const basicCwd = path.join(fixturesDir, 'basic')
const monorepoCwd = path.join(fixturesDir, 'monorepo', 'packages', 'app')

const basicEntryConfig = createEntryConfig(basicCwd, 'src/main.ts')
const monorepoEntryConfig = createEntryConfig(monorepoCwd, 'src/main.tsx')

describe('buildDependencyGraph', () => {
  bench('basic fixture', () => {
    buildDependencyGraph([basicEntryConfig], {
      cwd: basicCwd,
      expandWorkspaces: true,
      projectOnly: false,
      trackUnusedImports: true,
    })
  })

  bench('basic fixture without unused-import tracking', () => {
    buildDependencyGraph([basicEntryConfig], {
      cwd: basicCwd,
      expandWorkspaces: true,
      projectOnly: false,
      trackUnusedImports: false,
    })
  })

  bench('monorepo fixture', () => {
    buildDependencyGraph([monorepoEntryConfig], {
      cwd: monorepoCwd,
      expandWorkspaces: true,
      projectOnly: false,
      trackUnusedImports: true,
    })
  })
})

function createEntryConfig(cwd: string, entryFile: string): EntryConfig {
  const entryPath = resolveExistingPath(cwd, entryFile)
  const loaded = loadCompilerOptions(path.dirname(entryPath))

  return {
    entryPath,
    compilerOptions: loaded.compilerOptions,
    ...(loaded.path === undefined ? {} : { configPath: loaded.path }),
  }
}
