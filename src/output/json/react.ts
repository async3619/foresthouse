import {
  getFilteredUsages,
  getReactUsageEntries,
  getReactUsageRoots,
} from '../../analyzers/react/queries.js'
import type {
  ReactUsageEntry,
  ReactUsageFilter,
  ReactUsageGraph,
} from '../../types/index.js'
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
  readonly filePath: string
  readonly line: number
  readonly column: number
  readonly node: SerializedReactUsageNode
}

interface SerializedReactUsageEdge {
  readonly kind: import('../../types/react-usage-edge.js').ReactUsageEdge['kind']
  readonly targetId: string
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
      filePath: toDisplayPath(node.filePath, graph.cwd),
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
    filePath: toDisplayPath(node.filePath, graph.cwd),
    exportNames: node.exportNames,
    usages: getFilteredUsages(node, graph, filter).map((usage) => ({
      kind: usage.kind,
      targetId: usage.target,
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
    filePath: toDisplayPath(entry.location.filePath, graph.cwd),
    line: entry.location.line,
    column: entry.location.column,
    node: serializeReactUsageNode(entry.target, graph, filter, new Set()),
  }
}
