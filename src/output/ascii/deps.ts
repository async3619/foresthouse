import type { PackageDependencyGraph } from '../../types/package-dependency-graph.js'
import type { PackageManifestDependency } from '../../types/package-manifest-dependency.js'
import type { PrintPackageTreeOptions } from '../../types/print-package-tree-options.js'
import { toDisplayPath } from '../../utils/to-display-path.js'

export function printPackageDependencyTree(
  graph: PackageDependencyGraph,
  _options: PrintPackageTreeOptions = {},
): string {
  const rootNode = graph.nodes.get(graph.rootId)
  if (rootNode === undefined) {
    return toDisplayPath(graph.rootId, graph.repositoryRoot)
  }

  const lines = [rootNode.packageName]
  const visited = new Set<string>([graph.rootId])

  rootNode.dependencies.forEach((dependency, index) => {
    lines.push(
      ...renderDependency(
        dependency,
        graph,
        visited,
        '',
        index === rootNode.dependencies.length - 1,
      ),
    )
  })

  return lines.join('\n')
}

function renderDependency(
  dependency: PackageManifestDependency,
  graph: PackageDependencyGraph,
  visited: ReadonlySet<string>,
  prefix: string,
  isLast: boolean,
): string[] {
  const branch = `${prefix}${isLast ? '└─ ' : '├─ '}`
  const label = formatDependencyLabel(dependency, graph.repositoryRoot)

  if (dependency.kind === 'external') {
    return [`${branch}${label}`]
  }

  if (visited.has(dependency.target)) {
    return [`${branch}${label} (circular)`]
  }

  const childNode = graph.nodes.get(dependency.target)
  if (childNode === undefined) {
    return [`${branch}${label}`]
  }

  const childLines = [`${branch}${label}`]
  const nextPrefix = `${prefix}${isLast ? '   ' : '│  '}`
  const nextVisited = new Set(visited)
  nextVisited.add(dependency.target)

  childNode.dependencies.forEach((childDependency, index) => {
    childLines.push(
      ...renderDependency(
        childDependency,
        graph,
        nextVisited,
        nextPrefix,
        index === childNode.dependencies.length - 1,
      ),
    )
  })

  return childLines
}

function formatDependencyLabel(
  dependency: PackageManifestDependency,
  repositoryRoot: string,
): string {
  if (dependency.kind === 'external') {
    return `${dependency.name}@${dependency.specifier}`
  }

  const workspaceLabel = toDisplayPath(dependency.target, repositoryRoot)

  if (dependency.specifier === undefined) {
    return workspaceLabel
  }

  return `${workspaceLabel} (${dependency.specifier})`
}
