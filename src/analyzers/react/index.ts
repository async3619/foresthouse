import fs from 'node:fs'

import { parseSync } from 'oxc-parser'

import type {
  AnalyzeOptions,
  ReactUsageEdge,
  ReactUsageEntry,
  ReactUsageGraph,
  ReactUsageNode,
} from '../../types.js'
import { isSourceCodeFile } from '../../utils/is-source-code-file.js'
import { analyzeDependencies } from '../import/index.js'
import { analyzeReactFile } from './file.js'
import {
  addExternalHookNodes,
  compareReactNodeIds,
  compareReactUsageEntries,
  resolveReactReference,
} from './references.js'

export function analyzeReactUsage(
  entryFile: string,
  options: AnalyzeOptions = {},
): ReactUsageGraph {
  const dependencyGraph = analyzeDependencies(entryFile, options)
  const reachableFiles = new Set<string>([
    dependencyGraph.entryId,
    ...dependencyGraph.nodes.keys(),
  ])
  const fileAnalyses = new Map<string, import('./file.js').FileAnalysis>()

  for (const filePath of [...reachableFiles].sort()) {
    if (!isSourceCodeFile(filePath) || filePath.endsWith('.d.ts')) {
      continue
    }

    const sourceText = fs.readFileSync(filePath, 'utf8')
    const parseResult = parseSync(filePath, sourceText, {
      astType: 'ts',
      sourceType: 'unambiguous',
    })

    const dependencyNode = dependencyGraph.nodes.get(filePath)
    const sourceDependencies = new Map<string, string>()
    dependencyNode?.dependencies.forEach((dependency) => {
      if (dependency.kind === 'source') {
        sourceDependencies.set(dependency.specifier, dependency.target)
      }
    })

    fileAnalyses.set(
      filePath,
      analyzeReactFile(
        parseResult.program,
        filePath,
        sourceText,
        filePath === dependencyGraph.entryId,
        sourceDependencies,
      ),
    )
  }

  const nodes = new Map<string, ReactUsageNode>()
  for (const fileAnalysis of fileAnalyses.values()) {
    for (const symbol of fileAnalysis.symbolsById.values()) {
      nodes.set(symbol.id, {
        id: symbol.id,
        name: symbol.name,
        kind: symbol.kind,
        filePath: symbol.filePath,
        exportNames: [...symbol.exportNames].sort(),
        usages: [],
      })
    }
  }

  addExternalHookNodes(fileAnalyses, nodes)

  for (const fileAnalysis of fileAnalyses.values()) {
    for (const symbol of fileAnalysis.symbolsById.values()) {
      const usages = new Map<string, ReactUsageEdge>()

      symbol.componentReferences.forEach((referenceName) => {
        const targetId = resolveReactReference(
          fileAnalysis,
          fileAnalyses,
          referenceName,
          'component',
        )
        if (targetId !== undefined && targetId !== symbol.id) {
          usages.set(`render:${targetId}`, {
            kind: 'render',
            target: targetId,
          })
        }
      })

      symbol.hookReferences.forEach((referenceName) => {
        const targetId = resolveReactReference(
          fileAnalysis,
          fileAnalyses,
          referenceName,
          'hook',
        )
        if (targetId !== undefined && targetId !== symbol.id) {
          usages.set(`hook:${targetId}`, {
            kind: 'hook-call',
            target: targetId,
          })
        }
      })

      const node = nodes.get(symbol.id)
      if (node === undefined) {
        continue
      }

      const sortedUsages = [...usages.values()].sort((left, right) =>
        compareReactNodeIds(left.target, right.target, nodes),
      )

      nodes.set(symbol.id, {
        ...node,
        usages: sortedUsages,
      })
    }
  }

  const entriesByKey = new Map<string, ReactUsageEntry>()
  for (const fileAnalysis of fileAnalyses.values()) {
    for (const entry of fileAnalysis.entryUsages) {
      const targetId = resolveReactReference(
        fileAnalysis,
        fileAnalyses,
        entry.referenceName,
        entry.kind,
      )
      if (targetId === undefined) {
        continue
      }

      const key = `${entry.location.filePath}:${entry.location.line}:${entry.location.column}:${targetId}`
      entriesByKey.set(key, {
        target: targetId,
        location: entry.location,
      })
    }
  }

  const entries = [...entriesByKey.values()].sort((left, right) =>
    compareReactUsageEntries(left, right, nodes),
  )

  return {
    cwd: dependencyGraph.cwd,
    entryId: dependencyGraph.entryId,
    nodes,
    entries,
  }
}
