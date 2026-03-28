import {
  getFilteredUsages,
  getReactUsageEntries,
  getReactUsageRoots,
} from '../../analyzers/react/queries.js'
import {
  colorizeMuted,
  colorizePackageDiff,
  colorizeReactLabel,
  formatReactSymbolLabel,
  formatReactSymbolName,
  resolveColorSupport,
} from '../../color.js'
import type { PrintReactTreeOptions } from '../../types/print-react-tree-options.js'
import type { ReactUsageDiffEdge } from '../../types/react-usage-diff-edge.js'
import type { ReactUsageDiffEntry } from '../../types/react-usage-diff-entry.js'
import type { ReactUsageDiffGraph } from '../../types/react-usage-diff-graph.js'
import type { ReactUsageDiffNode } from '../../types/react-usage-diff-node.js'
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

export function printReactUsageDiffTree(
  graph: ReactUsageDiffGraph,
  options: PrintReactTreeOptions = {},
): string {
  const color = resolveColorSupport(options.color)

  if (graph.entries.length > 0) {
    return renderReactDiffEntries(graph.entries, color)
  }

  if (graph.roots.length === 0) {
    return 'No React changes found.'
  }

  const lines: string[] = []

  graph.roots.forEach((root, index) => {
    lines.push(
      formatDiffLine(root.change, formatReactDiffNodeLabel(root, color), color),
    )
    root.usages.forEach((usage, usageIndex) => {
      lines.push(
        ...renderDiffUsage(
          usage,
          color,
          '',
          usageIndex === root.usages.length - 1,
        ),
      )
    })

    if (index < graph.roots.length - 1) {
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
    ? `${colorizeReactLabel(formatReactSymbolName(node.name, node.kind), node.kind, color)} ${colorizeMuted(
        `as ${referenceName}`,
        color,
      )} ${colorizeReactLabel(`[${node.kind}]`, node.kind, color)}`
    : formatReactSymbolLabel(node.name, node.kind, color)

  return `${label} (${formatReactNodeFilePath(node, cwd)})`
}

function formatReactEntryLabel(entry: ReactUsageEntry, cwd: string): string {
  return `${toDisplayPath(entry.location.filePath, cwd)}:${entry.location.line}:${entry.location.column}`
}

function formatReactNodeFilePath(node: ReactUsageNode, cwd: string): string {
  return node.kind === 'builtin' ? 'html' : toDisplayPath(node.filePath, cwd)
}

function renderReactDiffEntries(
  entries: readonly ReactUsageDiffEntry[],
  color: boolean,
): string {
  const lines: string[] = []

  entries.forEach((entry, index) => {
    lines.push(
      formatDiffLine(
        resolveVisibleEntryChange(entry),
        formatReactDiffEntryLabel(entry),
        color,
      ),
    )
    lines.push(
      formatDiffLine(
        entry.node.change,
        formatReactDiffNodeLabel(
          entry.node,
          color,
          entry.beforeReferenceName,
          entry.afterReferenceName,
        ),
        color,
      ),
    )

    entry.node.usages.forEach((usage, usageIndex) => {
      lines.push(
        ...renderDiffUsage(
          usage,
          color,
          '',
          usageIndex === entry.node.usages.length - 1,
        ),
      )
    })

    if (index < entries.length - 1) {
      lines.push('')
    }
  })

  return lines.join('\n')
}

function renderDiffUsage(
  usage: ReactUsageDiffEdge,
  color: boolean,
  prefix: string,
  isLast: boolean,
): string[] {
  const branch = `${prefix}${isLast ? '└─ ' : '├─ '}`
  const line = `${branch}${formatDiffLine(
    resolveVisibleEdgeChange(usage),
    formatReactDiffNodeLabel(
      usage.node,
      color,
      usage.beforeReferenceName,
      usage.afterReferenceName,
    ),
    color,
  )}`

  if (usage.node.circular === true) {
    return [`${line} (circular)`]
  }

  const childLines = [line]
  const nextPrefix = `${prefix}${isLast ? '   ' : '│  '}`

  usage.node.usages.forEach((childUsage, index) => {
    childLines.push(
      ...renderDiffUsage(
        childUsage,
        color,
        nextPrefix,
        index === usage.node.usages.length - 1,
      ),
    )
  })

  return childLines
}

function formatReactDiffEntryLabel(entry: ReactUsageDiffEntry): string {
  const beforeLocation =
    entry.beforeFilePath === undefined ||
    entry.beforeLine === undefined ||
    entry.beforeColumn === undefined
      ? undefined
      : `${entry.beforeFilePath}:${entry.beforeLine}:${entry.beforeColumn}`
  const afterLocation =
    entry.afterFilePath === undefined ||
    entry.afterLine === undefined ||
    entry.afterColumn === undefined
      ? undefined
      : `${entry.afterFilePath}:${entry.afterLine}:${entry.afterColumn}`

  if (
    entry.change === 'changed' &&
    beforeLocation !== undefined &&
    afterLocation !== undefined
  ) {
    return `${beforeLocation} -> ${afterLocation}`
  }

  return afterLocation ?? beforeLocation ?? entry.referenceName
}

function formatReactDiffNodeLabel(
  node: ReactUsageDiffNode,
  color: boolean,
  beforeReferenceName?: string,
  afterReferenceName?: string,
): string {
  const label = formatReactDiffSymbolLabel(
    node.name,
    node.symbolKind,
    color,
    beforeReferenceName,
    afterReferenceName,
  )

  return `${label} (${node.filePath})`
}

function formatReactDiffSymbolLabel(
  name: string,
  kind: ReactUsageDiffNode['symbolKind'],
  color: boolean,
  beforeReferenceName?: string,
  afterReferenceName?: string,
): string {
  const referenceNames = [beforeReferenceName, afterReferenceName].filter(
    (referenceName): referenceName is string => referenceName !== undefined,
  )
  const hasMeaningfulAlias = referenceNames.some(
    (referenceName) => referenceName !== name,
  )

  if (!hasMeaningfulAlias) {
    return formatReactSymbolLabel(name, kind, color)
  }

  const aliasText = formatReactDiffAlias(
    name,
    beforeReferenceName,
    afterReferenceName,
  )

  return `${colorizeReactLabel(formatReactSymbolName(name, kind), kind, color)} ${colorizeMuted(
    aliasText,
    color,
  )} ${colorizeReactLabel(`[${kind}]`, kind, color)}`
}

function formatReactDiffAlias(
  name: string,
  beforeReferenceName?: string,
  afterReferenceName?: string,
): string {
  if (
    beforeReferenceName !== undefined &&
    afterReferenceName !== undefined &&
    beforeReferenceName !== afterReferenceName
  ) {
    return `as ${beforeReferenceName} -> ${afterReferenceName}`
  }

  const currentReferenceName = afterReferenceName ?? beforeReferenceName
  if (currentReferenceName === undefined || currentReferenceName === name) {
    return 'as self'
  }

  return `as ${currentReferenceName}`
}

function resolveVisibleEntryChange(
  entry: ReactUsageDiffEntry,
): 'added' | 'removed' | 'changed' | 'unchanged' {
  return entry.change === 'unchanged' ? entry.node.change : entry.change
}

function resolveVisibleEdgeChange(
  usage: ReactUsageDiffEdge,
): 'added' | 'removed' | 'changed' | 'unchanged' {
  return usage.change === 'unchanged' ? usage.node.change : usage.change
}

function formatDiffLine(
  change: 'added' | 'removed' | 'changed' | 'unchanged',
  text: string,
  color: boolean,
): string {
  if (change === 'unchanged') {
    return text
  }

  return colorizePackageDiff(`${toDiffMarker(change)} ${text}`, change, color)
}

function toDiffMarker(
  change: 'added' | 'removed' | 'changed',
): '+' | '-' | '~' {
  if (change === 'added') {
    return '+'
  }

  if (change === 'removed') {
    return '-'
  }

  return '~'
}
