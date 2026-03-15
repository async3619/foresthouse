import { toDisplayPath } from './path-utils.js'
import { getFilteredUsages, getReactUsageRoots } from './react-analyzer.js'
import type {
  PrintReactTreeOptions,
  ReactUsageEdge,
  ReactUsageGraph,
  ReactUsageNode,
} from './types.js'

export function printReactUsageTree(
  graph: ReactUsageGraph,
  options: PrintReactTreeOptions = {},
): string {
  const cwd = options.cwd ?? graph.cwd
  const filter = options.filter ?? 'all'
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

    lines.push(formatReactNodeLabel(root, cwd))
    const usages = getFilteredUsages(root, graph, filter)
    usages.forEach((usage, usageIndex) => {
      lines.push(
        ...renderUsage(
          usage,
          graph,
          cwd,
          filter,
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

function renderUsage(
  usage: ReactUsageEdge,
  graph: ReactUsageGraph,
  cwd: string,
  filter: NonNullable<PrintReactTreeOptions['filter']>,
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
    return [`${branch}${formatReactNodeLabel(target, cwd)} (circular)`]
  }

  const childLines = [`${branch}${formatReactNodeLabel(target, cwd)}`]
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
        nextVisited,
        nextPrefix,
        index === childUsages.length - 1,
      ),
    )
  })

  return childLines
}

function formatReactNodeLabel(node: ReactUsageNode, cwd: string): string {
  return `${node.name} [${node.kind}] (${toDisplayPath(node.filePath, cwd)})`
}
