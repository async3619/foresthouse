import fs from 'node:fs'

import { parseSync } from 'oxc-parser'

import type { AnalyzeOptions } from '../../types/analyze-options.js'
import type { ReactUsageEdge } from '../../types/react-usage-edge.js'
import type { ReactUsageEntry } from '../../types/react-usage-entry.js'
import type { ReactUsageGraph } from '../../types/react-usage-graph.js'
import type { ReactUsageNode } from '../../types/react-usage-node.js'
import { isSourceCodeFile } from '../../utils/is-source-code-file.js'
import { BaseAnalyzer } from '../base.js'
import {
  analyzeDependenciesForEntries,
  type MultiEntryDependencyGraph,
} from '../import/index.js'
import { analyzeReactFile } from './file.js'
import {
  addBuiltinNodes,
  addExternalHookNodes,
  compareReactNodeIds,
  compareReactUsageEntries,
  getBuiltinNodeId,
  resolveReactReference,
} from './references.js'

export function analyzeReactUsage(
  entryFile: string | readonly string[],
  options: AnalyzeOptions = {},
): ReactUsageGraph {
  return new ReactAnalyzer(normalizeEntryFiles(entryFile), options).analyze()
}

class ReactAnalyzer extends BaseAnalyzer<ReactUsageGraph> {
  constructor(
    private readonly entryFiles: readonly string[],
    options: AnalyzeOptions,
  ) {
    const [firstEntryFile] = entryFiles
    if (firstEntryFile === undefined) {
      throw new Error('At least one React entry file is required.')
    }

    super(firstEntryFile, options)
  }

  protected doAnalyze(): ReactUsageGraph {
    const dependencyGraph = analyzeDependenciesForEntries(this.entryFiles, {
      ...this.options,
      trackUnusedImports: false,
    })
    const fileAnalyses = this.collectFileAnalyses(dependencyGraph)
    const nodes = this.createNodes(fileAnalyses)
    this.attachUsages(fileAnalyses, nodes)
    const entries = this.collectEntries(fileAnalyses, nodes)

    return {
      cwd: dependencyGraph.cwd,
      entryId: dependencyGraph.entryId,
      entryIds: dependencyGraph.entryIds,
      nodes,
      entries,
    }
  }

  private collectFileAnalyses(
    dependencyGraph: MultiEntryDependencyGraph,
  ): Map<string, import('./file.js').FileAnalysis> {
    const reachableFiles = new Set<string>([
      ...dependencyGraph.entryIds,
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
          dependencyGraph.entryIds.includes(filePath),
          sourceDependencies,
          this.options.includeBuiltins === true,
        ),
      )
    }

    return fileAnalyses
  }

  private createNodes(
    fileAnalyses: ReadonlyMap<string, import('./file.js').FileAnalysis>,
  ): Map<string, ReactUsageNode> {
    const nodes = new Map<string, ReactUsageNode>()

    for (const fileAnalysis of fileAnalyses.values()) {
      for (const symbol of fileAnalysis.allSymbolsById.values()) {
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
    if (this.options.includeBuiltins === true) {
      addBuiltinNodes(fileAnalyses, nodes)
    }
    return nodes
  }

  private attachUsages(
    fileAnalyses: ReadonlyMap<string, import('./file.js').FileAnalysis>,
    nodes: Map<string, ReactUsageNode>,
  ): void {
    for (const fileAnalysis of fileAnalyses.values()) {
      for (const symbol of fileAnalysis.allSymbolsById.values()) {
        const usages = new Map<string, ReactUsageEdge>()

        symbol.componentReferences.forEach((referenceName) => {
          const targetId = resolveReactReference(
            fileAnalysis,
            fileAnalyses,
            referenceName,
            'component',
          )
          if (targetId !== undefined && targetId !== symbol.id) {
            usages.set(`render:${targetId}:${referenceName}`, {
              kind: 'render',
              target: targetId,
              referenceName,
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
            usages.set(`hook:${targetId}:${referenceName}`, {
              kind: 'hook-call',
              target: targetId,
              referenceName,
            })
          }
        })

        if (this.options.includeBuiltins === true) {
          symbol.builtinReferences.forEach((referenceName) => {
            const targetId = getBuiltinNodeId(referenceName)
            usages.set(`render:${targetId}:${referenceName}`, {
              kind: 'render',
              target: targetId,
              referenceName,
            })
          })
        }

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
  }

  private collectEntries(
    fileAnalyses: ReadonlyMap<string, import('./file.js').FileAnalysis>,
    nodes: ReadonlyMap<string, ReactUsageNode>,
  ): ReactUsageEntry[] {
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
          referenceName: entry.referenceName,
          location: entry.location,
        })
      }
    }

    return [...entriesByKey.values()].sort((left, right) =>
      compareReactUsageEntries(left, right, nodes),
    )
  }
}

function normalizeEntryFiles(entryFile: string | readonly string[]): string[] {
  const entryFiles = Array.isArray(entryFile) ? entryFile : [entryFile]
  const dedupedEntryFiles = [...new Set(entryFiles)]

  if (dedupedEntryFiles.length === 0) {
    throw new Error('At least one React entry file is required.')
  }

  return dedupedEntryFiles
}
