import path from 'node:path'

import type { AnalyzeOptions, DependencyGraph } from '../../types.js'
import { loadCompilerOptions } from '../../typescript/config.js'
import { resolveExistingPath } from './entry.js'
import { buildDependencyGraph } from './graph.js'

export function analyzeDependencies(
  entryFile: string,
  options: AnalyzeOptions = {},
): DependencyGraph {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const resolvedEntryPath = resolveExistingPath(cwd, entryFile)
  const { compilerOptions, path: configPath } = loadCompilerOptions(
    path.dirname(resolvedEntryPath),
    options.configPath,
  )
  const nodes = buildDependencyGraph(resolvedEntryPath, compilerOptions, cwd)

  return {
    cwd,
    entryId: resolvedEntryPath,
    nodes,
    ...(configPath === undefined ? {} : { configPath }),
  }
}
