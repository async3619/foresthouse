import type {
  ReactUsageEdge,
  ReactUsageEntry,
  ReactUsageFilter,
  ReactUsageGraph,
  ReactUsageNode,
} from '../../types/index.js'
import { compareReactNodeIds } from './references.js'

export function getReactUsageEntries(
  graph: ReactUsageGraph,
  filter: ReactUsageFilter = 'all',
): ReactUsageEntry[] {
  return graph.entries.filter((entry) => {
    const targetNode = graph.nodes.get(entry.target)
    return targetNode !== undefined && matchesReactFilter(targetNode, filter)
  })
}

export function getReactUsageRoots(
  graph: ReactUsageGraph,
  filter: ReactUsageFilter = 'all',
): string[] {
  const entries = getReactUsageEntries(graph, filter)
  if (entries.length > 0) {
    return [...new Set(entries.map((entry) => entry.target))]
  }

  const filteredNodes = getFilteredReactUsageNodes(graph, filter)
  const inboundCounts = new Map<string, number>()

  filteredNodes.forEach((node) => {
    inboundCounts.set(node.id, 0)
  })

  filteredNodes.forEach((node) => {
    getFilteredUsages(node, graph, filter).forEach((usage) => {
      inboundCounts.set(
        usage.target,
        (inboundCounts.get(usage.target) ?? 0) + 1,
      )
    })
  })

  const roots = filteredNodes
    .filter((node) => (inboundCounts.get(node.id) ?? 0) === 0)
    .map((node) => node.id)

  if (roots.length > 0) {
    return roots.sort((left, right) =>
      compareReactNodeIds(left, right, graph.nodes),
    )
  }

  return filteredNodes
    .map((node) => node.id)
    .sort((left, right) => compareReactNodeIds(left, right, graph.nodes))
}

export function getFilteredUsages(
  node: ReactUsageNode,
  graph: ReactUsageGraph,
  filter: ReactUsageFilter = 'all',
): ReactUsageEdge[] {
  return node.usages.filter((usage) => {
    const targetNode = graph.nodes.get(usage.target)
    return targetNode !== undefined && matchesReactFilter(targetNode, filter)
  })
}

function getFilteredReactUsageNodes(
  graph: ReactUsageGraph,
  filter: ReactUsageFilter,
): ReactUsageNode[] {
  return [...graph.nodes.values()]
    .filter((node) => matchesReactFilter(node, filter))
    .sort((left, right) => {
      return (
        left.filePath.localeCompare(right.filePath) ||
        left.name.localeCompare(right.name) ||
        left.kind.localeCompare(right.kind)
      )
    })
}

function matchesReactFilter(
  node: ReactUsageNode,
  filter: ReactUsageFilter,
): boolean {
  return filter === 'all' || node.kind === filter
}
