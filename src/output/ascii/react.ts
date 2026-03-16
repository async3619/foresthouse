import {
  getFilteredUsages,
  getReactUsageEntries,
  getReactUsageRoots,
} from '../../analyzers/react/queries.js'
import {
  colorizeMuted,
  colorizeReactLabel,
  formatReactSymbolLabel,
  resolveColorSupport,
} from '../../color.js'
import type { PrintReactTreeOptions } from '../../types/print-react-tree-options.js'
import type { ReactUsageEdge } from '../../types/react-usage-edge.js'
import type { ReactUsageEntry } from '../../types/react-usage-entry.js'
import type { ReactUsageGraph } from '../../types/react-usage-graph.js'
import type { ReactUsageNode } from '../../types/react-usage-node.js'
import { toDisplayPath } from '../../utils/to-display-path.js'

export function printReactUsageTree(
  graph: ReactUsageGraph,
  options: PrintReactTreeOptions = {},
): string {
  const cwd = options.cwd ?? graph.cwd
  const color = resolveColorSupport(options.color)
  const filter = options.filter ?? 'all'
  const entries = getReactUsageEntries(graph, filter)

  if (entries.length > 0) {
    return renderReactUsageEntries(graph, entries, cwd, filter, color)
  }

  const roots = getReactUsageRoots(graph, filter)
  if (roots.length === 0) {
    return 'No React symbols found.'
  }

  const lines: string[] = []
  roots.forEach((rootId, index) => {
    const root = graph.nodes.get(rootId)
    if (root === undefined) {
      return
    }

    lines.push(formatReactNodeLabel(root, cwd, color))
    const usages = getFilteredUsages(root, graph, filter)
    usages.forEach((usage, usageIndex) => {
      lines.push(
        ...renderUsage(
          usage,
          graph,
          cwd,
          filter,
          color,
          new Set([root.id]),
          '',
          usageIndex === usages.length - 1,
        ),
      )
    })

    if (index < roots.length - 1) {
      lines.push('')
    }
  })

  return lines.join('\n')
}

function renderReactUsageEntries(
  graph: ReactUsageGraph,
  entries: readonly ReactUsageEntry[],
  cwd: string,
  filter: NonNullable<PrintReactTreeOptions['filter']>,
  color: boolean,
): string {
  const lines: string[] = []

  entries.forEach((entry, index) => {
    const root = graph.nodes.get(entry.target)
    if (root === undefined) {
      return
    }

    lines.push(formatReactEntryLabel(entry, cwd))
    lines.push(formatReactNodeLabel(root, cwd, color, entry.referenceName))

    const usages = getFilteredUsages(root, graph, filter)
    usages.forEach((usage, usageIndex) => {
      lines.push(
        ...renderUsage(
          usage,
          graph,
          cwd,
          filter,
          color,
          new Set([root.id]),
          '',
          usageIndex === usages.length - 1,
        ),
      )
    })

    if (index < entries.length - 1) {
      lines.push('')
    }
  })

  return lines.join('\n')
}

function renderUsage(
  usage: ReactUsageEdge,
  graph: ReactUsageGraph,
  cwd: string,
  filter: NonNullable<PrintReactTreeOptions['filter']>,
  color: boolean,
  visited: ReadonlySet<string>,
  prefix: string,
  isLast: boolean,
): string[] {
  const branch = `${prefix}${isLast ? '└─ ' : '├─ '}`
  const target = graph.nodes.get(usage.target)

  if (target === undefined) {
    return [`${branch}${usage.target}`]
  }

  if (visited.has(target.id)) {
    return [
      `${branch}${formatReactNodeLabel(target, cwd, color, usage.referenceName)} (circular)`,
    ]
  }

  const childLines = [
    `${branch}${formatReactNodeLabel(target, cwd, color, usage.referenceName)}`,
  ]
  const nextVisited = new Set(visited)
  nextVisited.add(target.id)
  const nextPrefix = `${prefix}${isLast ? '   ' : '│  '}`
  const childUsages = getFilteredUsages(target, graph, filter)

  childUsages.forEach((childUsage, index) => {
    childLines.push(
      ...renderUsage(
        childUsage,
        graph,
        cwd,
        filter,
        color,
        nextVisited,
        nextPrefix,
        index === childUsages.length - 1,
      ),
    )
  })

  return childLines
}

function formatReactNodeLabel(
  node: ReactUsageNode,
  cwd: string,
  color: boolean,
  referenceName?: string,
): string {
  const hasAlias = referenceName !== undefined && referenceName !== node.name
  const label = hasAlias
    ? `${colorizeReactLabel(node.name, node.kind, color)} ${colorizeMuted(
        `as ${referenceName}`,
        color,
      )} ${colorizeReactLabel(`[${node.kind}]`, node.kind, color)}`
    : formatReactSymbolLabel(node.name, node.kind, color)

  return `${label} (${toDisplayPath(node.filePath, cwd)})`
}

function formatReactEntryLabel(entry: ReactUsageEntry, cwd: string): string {
  return `${toDisplayPath(entry.location.filePath, cwd)}:${entry.location.line}:${entry.location.column}`
}
