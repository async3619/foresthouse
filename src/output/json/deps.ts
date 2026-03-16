import type { PackageDependencyDiffDependency } from '../../types/package-dependency-diff-dependency.js'
import type { PackageDependencyDiffGraph } from '../../types/package-dependency-diff-graph.js'
import type { PackageDependencyDiffNode } from '../../types/package-dependency-diff-node.js'
import type { PackageDependencyGraph } from '../../types/package-dependency-graph.js'
import type { PackageManifestDependency } from '../../types/package-manifest-dependency.js'
import { toDisplayPath } from '../../utils/to-display-path.js'

export function graphToSerializablePackageTree(
  graph: PackageDependencyGraph,
): object {
  return serializePackageNode(graph.rootId, graph, new Set())
}

export function diffGraphToSerializablePackageTree(
  graph: PackageDependencyDiffGraph,
): object {
  return serializePackageDiffNode(graph.root)
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

function serializePackageDiffNode(node: PackageDependencyDiffNode): object {
  return {
    kind: node.kind,
    label: node.label,
    packageName: node.packageName,
    path: node.path,
    change: node.change,
    contentChanged: node.contentChanged,
    ...(node.beforePackageName === undefined
      ? {}
      : { beforePackageName: node.beforePackageName }),
    ...(node.afterPackageName === undefined
      ? {}
      : { afterPackageName: node.afterPackageName }),
    dependencies: node.dependencies.map((dependency) =>
      serializePackageDiffDependency(dependency),
    ),
  }
}

function serializePackageDiffDependency(
  dependency: PackageDependencyDiffDependency,
): object {
  return {
    kind: dependency.kind,
    name: dependency.name,
    change: dependency.change,
    ...(dependency.before === undefined ? {} : { before: dependency.before }),
    ...(dependency.after === undefined ? {} : { after: dependency.after }),
    ...(dependency.after === undefined
      ? dependency.before === undefined
        ? {}
        : { target: dependency.before.target }
      : { target: dependency.after.target }),
    ...(dependency.kind === 'workspace'
      ? {
          propagated: dependency.propagated,
          node: serializePackageDiffNode(dependency.node),
        }
      : {}),
  }
}
