import {
  getFilteredUsages,
  getReactUsageEntries,
  getReactUsageRoots,
} from '../../analyzers/react/queries.js'
import type { ReactUsageDiffEdge } from '../../types/react-usage-diff-edge.js'
import type { ReactUsageDiffEntry } from '../../types/react-usage-diff-entry.js'
import type { ReactUsageDiffGraph } from '../../types/react-usage-diff-graph.js'
import type { ReactUsageDiffNode } from '../../types/react-usage-diff-node.js'
import type { ReactUsageEntry } from '../../types/react-usage-entry.js'
import type { ReactUsageFilter } from '../../types/react-usage-filter.js'
import type { ReactUsageGraph } from '../../types/react-usage-graph.js'
import { toDisplayPath } from '../../utils/to-display-path.js'

interface SerializedReactUsageNode {
  readonly id: string
  readonly name: string
  readonly symbolKind:
    | import('../../types/react-symbol-kind.js').ReactSymbolKind
    | 'circular'
  readonly filePath: string
  readonly exportNames: readonly string[]
  readonly usages: readonly SerializedReactUsageEdge[]
}

interface SerializedReactUsageEntry {
  readonly targetId: string
  readonly referenceName: string
  readonly filePath: string
  readonly line: number
  readonly column: number
  readonly node: SerializedReactUsageNode
}

interface SerializedReactUsageEdge {
  readonly kind: import('../../types/react-usage-edge.js').ReactUsageEdge['kind']
  readonly targetId: string
  readonly referenceName: string
  readonly node: SerializedReactUsageNode
}

export function graphToSerializableReactTree(
  graph: ReactUsageGraph,
  options: {
    readonly filter?: ReactUsageFilter
  } = {},
): object {
  const filter = options.filter ?? 'all'
  const entries = getReactUsageEntries(graph, filter)
  const roots =
    entries.length > 0
      ? entries.map((entry) =>
          serializeReactUsageNode(entry.target, graph, filter, new Set()),
        )
      : getReactUsageRoots(graph, filter).map((rootId) =>
          serializeReactUsageNode(rootId, graph, filter, new Set()),
        )

  return {
    kind: 'react-usage',
    entries: entries.map((entry) =>
      serializeReactUsageEntry(entry, graph, filter),
    ),
    roots,
  }
}

export function diffGraphToSerializableReactTree(
  graph: ReactUsageDiffGraph,
): object {
  return {
    kind: graph.kind,
    entries: graph.entries.map((entry) => serializeReactDiffEntry(entry)),
    roots: graph.roots.map((root) => serializeReactDiffNode(root)),
  }
}

function serializeReactUsageNode(
  nodeId: string,
  graph: ReactUsageGraph,
  filter: ReactUsageFilter,
  visited: Set<string>,
): SerializedReactUsageNode {
  const node = graph.nodes.get(nodeId)
  if (node === undefined) {
    return {
      id: nodeId,
      name: nodeId,
      symbolKind: 'circular',
      filePath: '',
      exportNames: [],
      usages: [],
    }
  }

  if (visited.has(nodeId)) {
    return {
      id: node.id,
      name: node.name,
      symbolKind: 'circular',
      filePath: formatReactNodeFilePath(node.filePath, node.kind, graph.cwd),
      exportNames: node.exportNames,
      usages: [],
    }
  }

  const nextVisited = new Set(visited)
  nextVisited.add(nodeId)

  return {
    id: node.id,
    name: node.name,
    symbolKind: node.kind,
    filePath: formatReactNodeFilePath(node.filePath, node.kind, graph.cwd),
    exportNames: node.exportNames,
    usages: getFilteredUsages(node, graph, filter).map((usage) => ({
      kind: usage.kind,
      targetId: usage.target,
      referenceName: usage.referenceName,
      node: serializeReactUsageNode(usage.target, graph, filter, nextVisited),
    })),
  }
}

function serializeReactUsageEntry(
  entry: ReactUsageEntry,
  graph: ReactUsageGraph,
  filter: ReactUsageFilter,
): SerializedReactUsageEntry {
  return {
    targetId: entry.target,
    referenceName: entry.referenceName,
    filePath: toDisplayPath(entry.location.filePath, graph.cwd),
    line: entry.location.line,
    column: entry.location.column,
    node: serializeReactUsageNode(entry.target, graph, filter, new Set()),
  }
}

function formatReactNodeFilePath(
  filePath: string,
  kind: import('../../types/react-symbol-kind.js').ReactSymbolKind,
  cwd: string,
): string {
  return kind === 'builtin' ? 'html' : toDisplayPath(filePath, cwd)
}

function serializeReactDiffNode(node: ReactUsageDiffNode): object {
  return {
    id: node.id,
    name: node.name,
    symbolKind: node.symbolKind,
    ...(node.circular === true ? { circular: true } : {}),
    filePath: node.filePath,
    change: node.change,
    exportNames: node.exportNames,
    ...(node.beforeExportNames === undefined
      ? {}
      : { beforeExportNames: node.beforeExportNames }),
    ...(node.afterExportNames === undefined
      ? {}
      : { afterExportNames: node.afterExportNames }),
    usages: node.usages.map((usage) => serializeReactDiffEdge(usage)),
  }
}

function serializeReactDiffEdge(usage: ReactUsageDiffEdge): object {
  return {
    key: usage.key,
    kind: usage.kind,
    change: usage.change,
    targetId: usage.targetId,
    referenceName: usage.referenceName,
    ...(usage.beforeReferenceName === undefined
      ? {}
      : { beforeReferenceName: usage.beforeReferenceName }),
    ...(usage.afterReferenceName === undefined
      ? {}
      : { afterReferenceName: usage.afterReferenceName }),
    node: serializeReactDiffNode(usage.node),
  }
}

function serializeReactDiffEntry(entry: ReactUsageDiffEntry): object {
  return {
    key: entry.key,
    change: entry.change,
    targetId: entry.targetId,
    referenceName: entry.referenceName,
    ...(entry.beforeReferenceName === undefined
      ? {}
      : { beforeReferenceName: entry.beforeReferenceName }),
    ...(entry.afterReferenceName === undefined
      ? {}
      : { afterReferenceName: entry.afterReferenceName }),
    ...(entry.beforeFilePath === undefined
      ? {}
      : { beforeFilePath: entry.beforeFilePath }),
    ...(entry.beforeLine === undefined ? {} : { beforeLine: entry.beforeLine }),
    ...(entry.beforeColumn === undefined
      ? {}
      : { beforeColumn: entry.beforeColumn }),
    ...(entry.afterFilePath === undefined
      ? {}
      : { afterFilePath: entry.afterFilePath }),
    ...(entry.afterLine === undefined ? {} : { afterLine: entry.afterLine }),
    ...(entry.afterColumn === undefined
      ? {}
      : { afterColumn: entry.afterColumn }),
    node: serializeReactDiffNode(entry.node),
  }
}
