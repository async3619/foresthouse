import { colorizeUnusedMarker, resolveColorSupport } from '../../color.js'
import type { DependencyEdge } from '../../types/dependency-edge.js'
import type { DependencyGraph } from '../../types/dependency-graph.js'
import type { PrintTreeOptions } from '../../types/print-tree-options.js'
import { toDisplayPath } from '../../utils/to-display-path.js'

export function printDependencyTree(
  graph: DependencyGraph,
  options: PrintTreeOptions = {},
): string {
  const cwd = options.cwd ?? graph.cwd
  const color = resolveColorSupport(options.color)
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
    rootLines.push(
      ...renderDependency(
        dependency,
        graph,
        visited,
        '',
        index === rootDependencies.length - 1,
        includeExternals,
        omitUnused,
        color,
        cwd,
      ),
    )
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
  color: boolean,
  cwd: string,
): string[] {
  const branch = `${prefix}${isLast ? '└─ ' : '├─ '}`
  const label = formatDependencyLabel(dependency, cwd, color)

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
    childLines.push(
      ...renderDependency(
        childDependency,
        graph,
        nextVisited,
        nextPrefix,
        index === childDependencies.length - 1,
        includeExternals,
        omitUnused,
        color,
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

    if (
      dependency.kind === 'source' ||
      dependency.kind === 'missing' ||
      dependency.kind === 'boundary'
    ) {
      return true
    }

    return includeExternals
  })
}

function formatDependencyLabel(
  dependency: DependencyEdge,
  cwd: string,
  color: boolean,
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
    return colorizeUnusedMarker(
      withUnusedSuffix(
        `${annotation}${toDisplayPath(dependency.target, cwd)}`,
        dependency.unused,
      ),
      color,
    )
  }

  if (dependency.kind === 'missing') {
    return colorizeUnusedMarker(
      withUnusedSuffix(
        `${annotation}${dependency.specifier} [missing]`,
        dependency.unused,
      ),
      color,
    )
  }

  if (dependency.kind === 'boundary') {
    return colorizeUnusedMarker(
      withUnusedSuffix(
        `${annotation}${toDisplayPath(dependency.target, cwd)} [${
          dependency.boundary === 'project'
            ? 'project boundary'
            : 'workspace boundary'
        }]`,
        dependency.unused,
      ),
      color,
    )
  }

  if (dependency.kind === 'builtin') {
    return colorizeUnusedMarker(
      withUnusedSuffix(
        `${annotation}${dependency.target} [builtin]`,
        dependency.unused,
      ),
      color,
    )
  }

  return colorizeUnusedMarker(
    withUnusedSuffix(
      `${annotation}${dependency.target} [external]`,
      dependency.unused,
    ),
    color,
  )
}

function withUnusedSuffix(label: string, unused: boolean): string {
  return unused ? `${label} (unused)` : label
}
