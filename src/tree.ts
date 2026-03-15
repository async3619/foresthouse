import { toDisplayPath } from './path-utils.js'
import type {
  DependencyEdge,
  DependencyGraph,
  PrintTreeOptions,
} from './types.js'

export function printDependencyTree(
  graph: DependencyGraph,
  options: PrintTreeOptions = {},
): string {
  const cwd = options.cwd ?? graph.cwd
  const includeExternals = options.includeExternals ?? false
  const omitUnused = options.omitUnused ?? false
  const rootLines = [toDisplayPath(graph.entryId, cwd)]
  const visited = new Set<string>([graph.entryId])
  const entryNode = graph.nodes.get(graph.entryId)

  if (entryNode === undefined) {
    return rootLines.join('\n')
  }

  const rootDependencies = filterDependencies(
    entryNode.dependencies,
    includeExternals,
    omitUnused,
  )

  rootDependencies.forEach((dependency, index) => {
    const isLast = index === rootDependencies.length - 1
    const lines = renderDependency(
      dependency,
      graph,
      visited,
      '',
      isLast,
      includeExternals,
      omitUnused,
      cwd,
    )
    rootLines.push(...lines)
  })

  return rootLines.join('\n')
}

function renderDependency(
  dependency: DependencyEdge,
  graph: DependencyGraph,
  visited: ReadonlySet<string>,
  prefix: string,
  isLast: boolean,
  includeExternals: boolean,
  omitUnused: boolean,
  cwd: string,
): string[] {
  const branch = `${prefix}${isLast ? '└─ ' : '├─ '}`
  const label = formatDependencyLabel(dependency, graph, cwd)

  if (dependency.kind !== 'source') {
    return [`${branch}${label}`]
  }

  if (visited.has(dependency.target)) {
    return [`${branch}${label} (circular)`]
  }

  const childNode = graph.nodes.get(dependency.target)
  if (childNode === undefined) {
    return [`${branch}${label}`]
  }

  const nextPrefix = `${prefix}${isLast ? '   ' : '│  '}`
  const nextVisited = new Set(visited)
  nextVisited.add(dependency.target)

  const childLines = [`${branch}${label}`]
  const childDependencies = filterDependencies(
    childNode.dependencies,
    includeExternals,
    omitUnused,
  )

  childDependencies.forEach((childDependency, index) => {
    const isChildLast = index === childDependencies.length - 1
    childLines.push(
      ...renderDependency(
        childDependency,
        graph,
        nextVisited,
        nextPrefix,
        isChildLast,
        includeExternals,
        omitUnused,
        cwd,
      ),
    )
  })

  return childLines
}

function filterDependencies(
  dependencies: readonly DependencyEdge[],
  includeExternals: boolean,
  omitUnused: boolean,
): DependencyEdge[] {
  return dependencies.filter((dependency) => {
    if (omitUnused && dependency.unused) {
      return false
    }

    if (dependency.kind === 'source' || dependency.kind === 'missing') {
      return true
    }

    return includeExternals
  })
}

function formatDependencyLabel(
  dependency: DependencyEdge,
  _graph: DependencyGraph,
  cwd: string,
): string {
  const prefixes: string[] = []
  if (dependency.isTypeOnly) {
    prefixes.push('type')
  }

  if (dependency.referenceKind === 'require') {
    prefixes.push('require')
  } else if (dependency.referenceKind === 'dynamic-import') {
    prefixes.push('dynamic')
  } else if (dependency.referenceKind === 'export') {
    prefixes.push('re-export')
  } else if (dependency.referenceKind === 'import-equals') {
    prefixes.push('import=')
  }

  const annotation = prefixes.length > 0 ? `[${prefixes.join(', ')}] ` : ''

  if (dependency.kind === 'source') {
    return withUnusedSuffix(
      `${annotation}${toDisplayPath(dependency.target, cwd)}`,
      dependency.unused,
    )
  }

  if (dependency.kind === 'missing') {
    return withUnusedSuffix(
      `${annotation}${dependency.specifier} [missing]`,
      dependency.unused,
    )
  }

  if (dependency.kind === 'builtin') {
    return withUnusedSuffix(
      `${annotation}${dependency.target} [builtin]`,
      dependency.unused,
    )
  }

  return withUnusedSuffix(
    `${annotation}${dependency.target} [external]`,
    dependency.unused,
  )
}

function withUnusedSuffix(label: string, unused: boolean): string {
  return unused ? `${label} (unused)` : label
}
