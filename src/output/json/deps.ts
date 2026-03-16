import type { PackageDependencyGraph } from '../../types/package-dependency-graph.js'
import type { PackageManifestDependency } from '../../types/package-manifest-dependency.js'
import { toDisplayPath } from '../../utils/to-display-path.js'

export function graphToSerializablePackageTree(
  graph: PackageDependencyGraph,
): object {
  return serializePackageNode(graph.rootId, graph, new Set())
}

function serializePackageNode(
  packageDir: string,
  graph: PackageDependencyGraph,
  visited: Set<string>,
): object {
  const packageNode = graph.nodes.get(packageDir)
  const packagePath = toDisplayPath(packageDir, graph.repositoryRoot)

  if (packageNode === undefined) {
    return {
      kind: 'missing',
      label: packagePath,
      path: packagePath,
      dependencies: [],
    }
  }

  if (visited.has(packageDir)) {
    return {
      kind: 'circular',
      label: packageNode.packageName,
      packageName: packageNode.packageName,
      path: packagePath,
      dependencies: [],
    }
  }

  visited.add(packageDir)

  return {
    kind: packageDir === graph.rootId ? 'root' : 'workspace',
    label: packageDir === graph.rootId ? packageNode.packageName : packagePath,
    packageName: packageNode.packageName,
    path: packagePath,
    dependencies: packageNode.dependencies.map((dependency) =>
      serializeDependency(dependency, graph, new Set(visited)),
    ),
  }
}

function serializeDependency(
  dependency: PackageManifestDependency,
  graph: PackageDependencyGraph,
  visited: Set<string>,
): object {
  if (dependency.kind === 'external') {
    return {
      kind: 'external',
      name: dependency.name,
      specifier: dependency.specifier,
      target: `${dependency.name}@${dependency.specifier}`,
    }
  }

  return {
    kind: 'workspace',
    name: dependency.name,
    ...(dependency.specifier === undefined
      ? {}
      : { specifier: dependency.specifier }),
    target: toDisplayPath(dependency.target, graph.repositoryRoot),
    node: serializePackageNode(dependency.target, graph, visited),
  }
}
