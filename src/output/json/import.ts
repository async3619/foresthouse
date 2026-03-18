import type { DependencyEdge } from '../../types/dependency-edge.js'
import type { DependencyGraph } from '../../types/dependency-graph.js'
import { toDisplayPath } from '../../utils/to-display-path.js'

export function graphToSerializableTree(
  graph: DependencyGraph,
  options: {
    readonly omitUnused?: boolean
  } = {},
): object {
  return serializeNode(
    graph.entryId,
    graph,
    new Set<string>(),
    new Set<string>(),
    options.omitUnused ?? false,
  )
}

function serializeNode(
  filePath: string,
  graph: DependencyGraph,
  visited: ReadonlySet<string>,
  expanded: Set<string>,
  omitUnused: boolean,
): object {
  const node = graph.nodes.get(filePath)
  const displayPath = toDisplayPath(filePath, graph.cwd)

  if (node === undefined) {
    return {
      path: displayPath,
      kind: 'missing',
      dependencies: [],
    }
  }

  if (visited.has(filePath)) {
    return {
      path: displayPath,
      kind: 'circular',
      dependencies: [],
    }
  }

  if (expanded.has(filePath)) {
    return {
      path: displayPath,
      kind: 'shared',
      dependencies: [],
    }
  }

  const nextVisited = new Set(visited)
  nextVisited.add(filePath)
  expanded.add(filePath)

  const dependencies = node.dependencies
    .filter((dependency) => !omitUnused || !dependency.unused)
    .map((dependency) => {
      if (dependency.kind !== 'source') {
        return {
          specifier: dependency.specifier,
          referenceKind: dependency.referenceKind,
          isTypeOnly: dependency.isTypeOnly,
          unused: dependency.unused,
          kind: dependency.kind,
          ...(dependency.boundary === undefined
            ? {}
            : { boundary: dependency.boundary }),
          target: serializeDependencyTarget(dependency, graph.cwd),
        }
      }

      return {
        specifier: dependency.specifier,
        referenceKind: dependency.referenceKind,
        isTypeOnly: dependency.isTypeOnly,
        unused: dependency.unused,
        kind: dependency.kind,
        target: toDisplayPath(dependency.target, graph.cwd),
        node: serializeNode(
          dependency.target,
          graph,
          nextVisited,
          expanded,
          omitUnused,
        ),
      }
    })

  return {
    path: displayPath,
    kind: filePath === graph.entryId ? 'entry' : 'source',
    dependencies,
  }
}

function serializeDependencyTarget(
  dependency: DependencyEdge,
  cwd: string,
): string {
  if (dependency.kind === 'missing' || dependency.kind === 'external') {
    return dependency.target
  }

  if (dependency.kind === 'builtin') {
    return dependency.target
  }

  return toDisplayPath(dependency.target, cwd)
}
