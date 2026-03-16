import fs from 'node:fs'

import { parseSync } from 'oxc-parser'

import type { AnalyzeOptions } from '../../types/analyze-options.js'
import type { DependencyGraph } from '../../types/dependency-graph.js'
import type { ReactUsageEdge } from '../../types/react-usage-edge.js'
import type { ReactUsageEntry } from '../../types/react-usage-entry.js'
import type { ReactUsageGraph } from '../../types/react-usage-graph.js'
import type { ReactUsageNode } from '../../types/react-usage-node.js'
import { isSourceCodeFile } from '../../utils/is-source-code-file.js'
import { BaseAnalyzer } from '../base.js'
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
  return new ReactAnalyzer(entryFile, options).analyze()
}

class ReactAnalyzer extends BaseAnalyzer<ReactUsageGraph> {
  protected doAnalyze(): ReactUsageGraph {
    const dependencyGraph = analyzeDependencies(this.entryFile, this.options)
    const fileAnalyses = this.collectFileAnalyses(dependencyGraph)
    const nodes = this.createNodes(fileAnalyses)
    this.attachUsages(fileAnalyses, nodes)
    const entries = this.collectEntries(fileAnalyses, nodes)

    return {
      cwd: dependencyGraph.cwd,
      entryId: dependencyGraph.entryId,
      nodes,
      entries,
    }
  }

  private collectFileAnalyses(
    dependencyGraph: DependencyGraph,
  ): Map<string, import('./file.js').FileAnalysis> {
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

    return fileAnalyses
  }

  private createNodes(
    fileAnalyses: ReadonlyMap<string, import('./file.js').FileAnalysis>,
  ): Map<string, ReactUsageNode> {
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
    return nodes
  }

  private attachUsages(
    fileAnalyses: ReadonlyMap<string, import('./file.js').FileAnalysis>,
    nodes: Map<string, ReactUsageNode>,
  ): void {
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
          location: entry.location,
        })
      }
    }

    return [...entriesByKey.values()].sort((left, right) =>
      compareReactUsageEntries(left, right, nodes),
    )
  }
}
