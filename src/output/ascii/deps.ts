import { colorizePackageDiff, resolveColorSupport } from '../../color.js'
import type { PackageDependencyChangeKind } from '../../types/package-dependency-change-kind.js'
import type { PackageDependencyDiffDependency } from '../../types/package-dependency-diff-dependency.js'
import type { PackageDependencyDiffGraph } from '../../types/package-dependency-diff-graph.js'
import type { PackageDependencyDiffNode } from '../../types/package-dependency-diff-node.js'
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

export function printPackageDependencyDiffTree(
  graph: PackageDependencyDiffGraph,
  options: PrintPackageTreeOptions = {},
): string {
  const color = resolveColorSupport(options.color)
  const lines = [formatDiffRootLabel(graph.root, color)]

  graph.root.dependencies.forEach((dependency, index) => {
    lines.push(
      ...renderDiffDependency(
        dependency,
        '',
        index === graph.root.dependencies.length - 1,
        color,
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

function renderDiffDependency(
  dependency: PackageDependencyDiffDependency,
  prefix: string,
  isLast: boolean,
  color: boolean,
): string[] {
  const branch = `${prefix}${isLast ? '└─ ' : '├─ '}`
  const line = `${branch}${formatDiffDependencyLine(dependency, color)}`

  if (dependency.kind === 'external') {
    return [line]
  }

  if (dependency.node.kind === 'circular') {
    return [`${line} (circular)`]
  }

  const childLines = [line]
  const nextPrefix = `${prefix}${isLast ? '   ' : '│  '}`

  dependency.node.dependencies.forEach((childDependency, index) => {
    childLines.push(
      ...renderDiffDependency(
        childDependency,
        nextPrefix,
        index === dependency.node.dependencies.length - 1,
        color,
      ),
    )
  })

  return childLines
}

function formatDiffRootLabel(
  node: PackageDependencyDiffNode,
  color: boolean,
): string {
  if (
    node.change === 'changed' &&
    node.beforePackageName !== undefined &&
    node.afterPackageName !== undefined
  ) {
    return colorizeDiffText(
      `${toMarker(node.change)} ${node.beforePackageName} -> ${node.afterPackageName}`,
      node.change,
      color,
    )
  }

  if (node.change === 'unchanged') {
    return node.packageName
  }

  return colorizeDiffText(
    `${toMarker(node.change)} ${node.packageName}`,
    node.change,
    color,
  )
}

function formatDiffDependencyLine(
  dependency: PackageDependencyDiffDependency,
  color: boolean,
): string {
  const marker = resolveVisibleDependencyMarker(dependency)
  const label = formatDiffDependencyLabel(dependency)

  if (marker === 'unchanged') {
    return label
  }

  return colorizeDiffText(`${toMarker(marker)} ${label}`, marker, color)
}

function resolveVisibleDependencyMarker(
  dependency: PackageDependencyDiffDependency,
): PackageDependencyChangeKind {
  if (dependency.change !== 'unchanged') {
    return dependency.change
  }

  if (
    dependency.kind === 'workspace' &&
    dependency.node.change !== 'unchanged'
  ) {
    return dependency.node.change
  }

  return 'unchanged'
}

function formatDiffDependencyLabel(
  dependency: PackageDependencyDiffDependency,
): string {
  if (dependency.kind === 'external') {
    return formatExternalDiffLabel(dependency)
  }

  return formatWorkspaceDiffLabel(dependency)
}

function formatExternalDiffLabel(
  dependency: Extract<PackageDependencyDiffDependency, { kind: 'external' }>,
): string {
  if (dependency.change !== 'changed') {
    return (
      dependency.after?.target ?? dependency.before?.target ?? dependency.name
    )
  }

  const previousSpecifier = dependency.before?.specifier ?? 'none'
  const nextSpecifier = dependency.after?.specifier ?? 'none'

  return `${dependency.name}@${previousSpecifier} -> ${nextSpecifier}`
}

function formatWorkspaceDiffLabel(
  dependency: Extract<PackageDependencyDiffDependency, { kind: 'workspace' }>,
): string {
  if (dependency.change !== 'changed') {
    return formatWorkspaceState(
      dependency.after ?? dependency.before,
      dependency.node.path,
    )
  }

  const previousTarget = dependency.before?.target ?? dependency.node.path
  const nextTarget = dependency.after?.target ?? dependency.node.path
  const targetLabel =
    previousTarget === nextTarget
      ? nextTarget
      : `${previousTarget} -> ${nextTarget}`
  const previousSpecifier = dependency.before?.specifier
  const nextSpecifier = dependency.after?.specifier

  if (previousSpecifier === nextSpecifier) {
    return formatWorkspaceState(
      {
        target: targetLabel,
        ...(nextSpecifier === undefined ? {} : { specifier: nextSpecifier }),
      },
      dependency.node.path,
    )
  }

  return formatWorkspaceState(
    {
      target: targetLabel,
      specifier: `${previousSpecifier ?? 'none'} -> ${nextSpecifier ?? 'none'}`,
    },
    dependency.node.path,
  )
}

function formatWorkspaceState(
  state:
    | {
        readonly target: string
        readonly specifier?: string
      }
    | undefined,
  fallbackTarget: string,
): string {
  const target = state?.target ?? fallbackTarget

  if (state?.specifier === undefined) {
    return target
  }

  return `${target} (${state.specifier})`
}

function toMarker(change: PackageDependencyChangeKind): '+' | '-' | '~' {
  if (change === 'added') {
    return '+'
  }

  if (change === 'removed') {
    return '-'
  }

  return '~'
}

function colorizeDiffText(
  text: string,
  change: PackageDependencyChangeKind,
  color: boolean,
): string {
  if (change === 'unchanged') {
    return text
  }

  return colorizePackageDiff(text, change, color)
}
