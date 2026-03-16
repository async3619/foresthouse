import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { PackageDependencyDiffGraph } from '../../types/package-dependency-diff-graph.js'
import type {
  PackageDependencyDiffDependency,
  PackageDependencyDiffState,
} from '../../types/package-dependency-diff-dependency.js'
import type { PackageDependencyDiffNode } from '../../types/package-dependency-diff-node.js'
import type { PackageDependencyChangeKind } from '../../types/package-dependency-change-kind.js'
import type { PackageDependencyGraph } from '../../types/package-dependency-graph.js'
import type { PackageManifestDependency } from '../../types/package-manifest-dependency.js'
import { toDisplayPath } from '../../utils/to-display-path.js'
import { analyzePackageDependencies } from './index.js'

interface GitDiffComparison {
  readonly beforeTree: string
  readonly afterTree: string | undefined
}

interface ComparablePackageDependencyGraph {
  readonly rootPath: string
  readonly nodes: ReadonlyMap<string, ComparablePackageDependencyNode>
}

interface ComparablePackageDependencyNode {
  readonly path: string
  readonly packageName: string
  readonly dependenciesByKey: ReadonlyMap<string, ComparablePackageDependency>
}

interface ComparableExternalPackageDependency {
  readonly kind: 'external'
  readonly key: string
  readonly name: string
  readonly specifier: string
}

interface ComparableWorkspacePackageDependency {
  readonly kind: 'workspace'
  readonly key: string
  readonly name: string
  readonly specifier: string | undefined
  readonly targetPath: string
}

type ComparablePackageDependency =
  | ComparableExternalPackageDependency
  | ComparableWorkspacePackageDependency

const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml'

export function analyzePackageDependencyDiff(
  directory: string,
  diff: string,
): PackageDependencyDiffGraph {
  const resolvedInputPath = path.resolve(process.cwd(), directory)
  const repositoryRoot = findGitRepositoryRoot(resolvedInputPath)
  const inputPathWithinRepository = resolveRepositoryInputPath(
    resolvedInputPath,
    repositoryRoot,
  )
  const comparison = resolveGitDiffComparison(repositoryRoot, diff)
  const beforeGraph = loadGitTreeGraph(
    repositoryRoot,
    comparison.beforeTree,
    inputPathWithinRepository,
  )
  const afterGraph =
    comparison.afterTree === undefined
      ? loadWorkingTreeGraph(repositoryRoot, inputPathWithinRepository)
      : loadGitTreeGraph(
          repositoryRoot,
          comparison.afterTree,
          inputPathWithinRepository,
        )

  if (beforeGraph === undefined && afterGraph === undefined) {
    throw new Error(`No package.json found from ${resolvedInputPath}`)
  }

  return {
    repositoryRoot,
    root: diffPackageNode(
      {
        beforePath: beforeGraph?.rootPath,
        afterPath: afterGraph?.rootPath,
        kind: 'root',
      },
      beforeGraph,
      afterGraph,
      new Set(),
    ),
  }
}

function resolveRepositoryInputPath(
  resolvedInputPath: string,
  repositoryRoot: string,
): string {
  const existingPath = findNearestExistingPath(resolvedInputPath)
  const existingRealPath = fs.realpathSync.native(existingPath)
  const repositoryRealPath = fs.realpathSync.native(repositoryRoot)
  const relativeFromExistingPath = path.relative(existingPath, resolvedInputPath)
  const relativeToRepository = path.relative(repositoryRealPath, existingRealPath)
  const normalizedPath = path.normalize(
    path.join(relativeToRepository, relativeFromExistingPath),
  )

  return normalizedPath === '.' ? '' : normalizedPath
}

function findGitRepositoryRoot(resolvedInputPath: string): string {
  const searchPath = findNearestExistingPath(resolvedInputPath)

  try {
    return runGit(searchPath, ['rev-parse', '--show-toplevel']).trim()
  } catch (error) {
    throw new Error(
      `Git diff mode requires a Git repository: ${getCommandErrorMessage(error)}`,
    )
  }
}

function findNearestExistingPath(resolvedInputPath: string): string {
  let currentPath = resolvedInputPath

  while (!fs.existsSync(currentPath)) {
    const parentPath = path.dirname(currentPath)

    if (parentPath === currentPath) {
      return resolvedInputPath
    }

    currentPath = parentPath
  }

  if (fs.statSync(currentPath).isFile()) {
    return path.dirname(currentPath)
  }

  return currentPath
}

function resolveGitDiffComparison(
  repositoryRoot: string,
  diff: string,
): GitDiffComparison {
  if (diff.includes('...')) {
    const [baseRef, headRef] = splitDiffRange(diff, '...')

    try {
      const mergeBase = runGit(repositoryRoot, [
        'merge-base',
        baseRef,
        headRef,
      ]).trim()

      return {
        beforeTree: resolveGitTree(repositoryRoot, mergeBase),
        afterTree: resolveGitTree(repositoryRoot, headRef),
      }
    } catch (error) {
      throw new Error(
        `Failed to resolve Git diff spec \`${diff}\`: ${getCommandErrorMessage(error)}`,
      )
    }
  }

  if (diff.includes('..')) {
    const [beforeRef, afterRef] = splitDiffRange(diff, '..')

    try {
      return {
        beforeTree: resolveGitTree(repositoryRoot, beforeRef),
        afterTree: resolveGitTree(repositoryRoot, afterRef),
      }
    } catch (error) {
      throw new Error(
        `Failed to resolve Git diff spec \`${diff}\`: ${getCommandErrorMessage(error)}`,
      )
    }
  }

  try {
    return {
      beforeTree: resolveGitTree(repositoryRoot, diff),
      afterTree: undefined,
    }
  } catch (error) {
    throw new Error(
      `Failed to resolve Git diff spec \`${diff}\`: ${getCommandErrorMessage(error)}`,
    )
  }
}

function splitDiffRange(
  diff: string,
  separator: '...' | '..',
): readonly [string, string] {
  const [left, right, ...extra] = diff.split(separator)

  if (
    left === undefined ||
    right === undefined ||
    left.length === 0 ||
    right.length === 0 ||
    extra.length > 0
  ) {
    throw new Error(`Invalid Git diff spec \`${diff}\``)
  }

  return [left, right]
}

function resolveGitTree(repositoryRoot: string, reference: string): string {
  return runGit(repositoryRoot, [
    'rev-parse',
    '--verify',
    `${reference}^{tree}`,
  ]).trim()
}

function loadWorkingTreeGraph(
  repositoryRoot: string,
  inputPathWithinRepository: string,
): ComparablePackageDependencyGraph | undefined {
  const packageGraph = tryAnalyzePackageGraph(
    resolveSnapshotInputPath(repositoryRoot, inputPathWithinRepository),
  )

  return packageGraph === undefined ? undefined : toComparableGraph(packageGraph)
}

function loadGitTreeGraph(
  repositoryRoot: string,
  tree: string,
  inputPathWithinRepository: string,
): ComparablePackageDependencyGraph | undefined {
  const snapshotRoot = materializeGitTreeSnapshot(repositoryRoot, tree)

  try {
    const packageGraph = tryAnalyzePackageGraph(
      resolveSnapshotInputPath(snapshotRoot, inputPathWithinRepository),
    )

    return packageGraph === undefined ? undefined : toComparableGraph(packageGraph)
  } finally {
    fs.rmSync(snapshotRoot, { recursive: true, force: true })
  }
}

function materializeGitTreeSnapshot(
  repositoryRoot: string,
  tree: string,
): string {
  const snapshotRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'foresthouse-deps-diff-'),
  )
  const trackedFiles = runGit(repositoryRoot, [
    'ls-tree',
    '-r',
    '-z',
    '--name-only',
    tree,
  ])
    .split('\u0000')
    .filter((filePath) => filePath.length > 0)

  trackedFiles.forEach((filePath) => {
    ensureSnapshotDirectory(snapshotRoot, filePath)
  })

  trackedFiles
    .filter(isManifestSnapshotFile)
    .forEach((filePath) => {
      const fileContent = runGit(
        repositoryRoot,
        ['cat-file', '-p', `${tree}:${filePath}`],
        {
          trim: false,
        },
      )
      const absolutePath = path.join(snapshotRoot, ...filePath.split('/'))

      fs.writeFileSync(absolutePath, fileContent)
    })

  return snapshotRoot
}

function ensureSnapshotDirectory(snapshotRoot: string, filePath: string): void {
  const parentDirectory = path.dirname(filePath)

  if (parentDirectory === '.') {
    return
  }

  fs.mkdirSync(path.join(snapshotRoot, ...parentDirectory.split('/')), {
    recursive: true,
  })
}

function isManifestSnapshotFile(filePath: string): boolean {
  const fileName = path.posix.basename(filePath)
  return fileName === 'package.json' || fileName === PNPM_WORKSPACE_FILE
}

function resolveSnapshotInputPath(
  snapshotRoot: string,
  inputPathWithinRepository: string,
): string {
  if (inputPathWithinRepository === '') {
    return snapshotRoot
  }

  return path.join(snapshotRoot, inputPathWithinRepository)
}

function tryAnalyzePackageGraph(
  inputPath: string,
): PackageDependencyGraph | undefined {
  if (!fs.existsSync(inputPath)) {
    return undefined
  }

  try {
    return analyzePackageDependencies(inputPath)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('No package.json found from ')
    ) {
      return undefined
    }

    throw error
  }
}

function toComparableGraph(
  graph: PackageDependencyGraph,
): ComparablePackageDependencyGraph {
  const nodes = new Map<string, ComparablePackageDependencyNode>()

  graph.nodes.forEach((node, packageDir) => {
    const packagePath = toDisplayPath(packageDir, graph.repositoryRoot)
    const dependenciesByKey = new Map<string, ComparablePackageDependency>()

    node.dependencies.forEach((dependency) => {
      dependenciesByKey.set(
        createDependencyKey(dependency),
        toComparableDependency(dependency, graph.repositoryRoot),
      )
    })

    nodes.set(packagePath, {
      path: packagePath,
      packageName: node.packageName,
      dependenciesByKey,
    })
  })

  return {
    rootPath: toDisplayPath(graph.rootId, graph.repositoryRoot),
    nodes,
  }
}

function createDependencyKey(dependency: PackageManifestDependency): string {
  return `${dependency.kind}:${dependency.name}`
}

function toComparableDependency(
  dependency: PackageManifestDependency,
  repositoryRoot: string,
): ComparablePackageDependency {
  if (dependency.kind === 'external') {
    return {
      kind: 'external',
      key: createDependencyKey(dependency),
      name: dependency.name,
      specifier: dependency.specifier,
    }
  }

  return {
    kind: 'workspace',
    key: createDependencyKey(dependency),
    name: dependency.name,
    specifier: dependency.specifier,
    targetPath: toDisplayPath(dependency.target, repositoryRoot),
  }
}

function diffPackageNode(
  location: {
    readonly beforePath: string | undefined
    readonly afterPath: string | undefined
    readonly kind: 'root' | 'workspace'
  },
  beforeGraph: ComparablePackageDependencyGraph | undefined,
  afterGraph: ComparablePackageDependencyGraph | undefined,
  ancestry: ReadonlySet<string>,
): PackageDependencyDiffNode {
  const nodeKey = `${location.beforePath ?? ''}->${location.afterPath ?? ''}`
  const beforeNode =
    location.beforePath === undefined
      ? undefined
      : beforeGraph?.nodes.get(location.beforePath)
  const afterNode =
    location.afterPath === undefined
      ? undefined
      : afterGraph?.nodes.get(location.afterPath)

  if (beforeNode === undefined && afterNode === undefined) {
    throw new Error('Unable to resolve package diff node.')
  }

  const packageName =
    afterNode?.packageName ??
    beforeNode?.packageName ??
    location.afterPath ??
    location.beforePath ??
    '.'
  const packagePath = location.afterPath ?? location.beforePath ?? '.'

  if (ancestry.has(nodeKey)) {
    return {
      kind: 'circular',
      label: location.kind === 'root' ? packageName : packagePath,
      packageName,
      path: packagePath,
      change: 'unchanged',
      dependencies: [],
    }
  }

  const nextAncestry = new Set(ancestry)
  nextAncestry.add(nodeKey)

  const dependencies = collectDependencyDiffs(
    beforeNode,
    afterNode,
    beforeGraph,
    afterGraph,
    nextAncestry,
  )
  const change = resolveNodeChange(location, beforeNode, afterNode, dependencies)

  return {
    kind: location.kind,
    label: location.kind === 'root' ? packageName : packagePath,
    packageName,
    path: packagePath,
    change,
    ...(beforeNode !== undefined &&
    afterNode !== undefined &&
    beforeNode.packageName !== afterNode.packageName
      ? {
          beforePackageName: beforeNode.packageName,
          afterPackageName: afterNode.packageName,
        }
      : {}),
    dependencies,
  }
}

function collectDependencyDiffs(
  beforeNode: ComparablePackageDependencyNode | undefined,
  afterNode: ComparablePackageDependencyNode | undefined,
  beforeGraph: ComparablePackageDependencyGraph | undefined,
  afterGraph: ComparablePackageDependencyGraph | undefined,
  ancestry: ReadonlySet<string>,
): PackageDependencyDiffDependency[] {
  const dependencyKeys = new Set<string>([
    ...Array.from(beforeNode?.dependenciesByKey.keys() ?? []),
    ...Array.from(afterNode?.dependenciesByKey.keys() ?? []),
  ])

  return Array.from(dependencyKeys)
    .sort((left, right) =>
      compareDependencyLabels(
        beforeNode?.dependenciesByKey.get(left) ??
          afterNode?.dependenciesByKey.get(left),
        beforeNode?.dependenciesByKey.get(right) ??
          afterNode?.dependenciesByKey.get(right),
      ),
    )
    .flatMap((dependencyKey) => {
      const dependency = diffDependency(
        beforeNode?.dependenciesByKey.get(dependencyKey),
        afterNode?.dependenciesByKey.get(dependencyKey),
        beforeGraph,
        afterGraph,
        ancestry,
      )

      return dependency === undefined ? [] : [dependency]
    })
}

function compareDependencyLabels(
  left: ComparablePackageDependency | undefined,
  right: ComparablePackageDependency | undefined,
): number {
  const leftLabel = left === undefined ? '' : getDependencySortLabel(left)
  const rightLabel = right === undefined ? '' : getDependencySortLabel(right)

  return leftLabel.localeCompare(rightLabel)
}

function getDependencySortLabel(dependency: ComparablePackageDependency): string {
  if (dependency.kind === 'external') {
    return `${dependency.name}@${dependency.specifier}`
  }

  return dependency.targetPath
}

function diffDependency(
  beforeDependency: ComparablePackageDependency | undefined,
  afterDependency: ComparablePackageDependency | undefined,
  beforeGraph: ComparablePackageDependencyGraph | undefined,
  afterGraph: ComparablePackageDependencyGraph | undefined,
  ancestry: ReadonlySet<string>,
): PackageDependencyDiffDependency | undefined {
  const change = resolveDependencyChange(beforeDependency, afterDependency)

  if (
    beforeDependency?.kind === 'workspace' ||
    afterDependency?.kind === 'workspace'
  ) {
    const workspaceDependency =
      afterDependency?.kind === 'workspace'
        ? afterDependency
        : beforeDependency?.kind === 'workspace'
          ? beforeDependency
          : undefined

    if (workspaceDependency === undefined) {
      return undefined
    }

    const node = diffPackageNode(
      {
        beforePath:
          beforeDependency?.kind === 'workspace'
            ? beforeDependency.targetPath
            : undefined,
        afterPath:
          afterDependency?.kind === 'workspace'
            ? afterDependency.targetPath
            : undefined,
        kind: 'workspace',
      },
      beforeGraph,
      afterGraph,
      ancestry,
    )

    if (change === 'unchanged' && !hasVisibleChanges(node)) {
      return undefined
    }

    return {
      kind: 'workspace',
      name: workspaceDependency.name,
      change,
      ...(beforeDependency === undefined
        ? {}
        : { before: toDiffState(beforeDependency) }),
      ...(afterDependency === undefined ? {} : { after: toDiffState(afterDependency) }),
      node,
    }
  }

  if (change === 'unchanged') {
    return undefined
  }

  const dependency = afterDependency ?? beforeDependency

  if (dependency === undefined || dependency.kind !== 'external') {
    return undefined
  }

  return {
    kind: 'external',
    name: dependency.name,
    change,
    ...(beforeDependency === undefined
      ? {}
      : { before: toDiffState(beforeDependency) }),
    ...(afterDependency === undefined ? {} : { after: toDiffState(afterDependency) }),
  }
}

function resolveDependencyChange(
  beforeDependency: ComparablePackageDependency | undefined,
  afterDependency: ComparablePackageDependency | undefined,
): PackageDependencyChangeKind {
  if (beforeDependency === undefined && afterDependency !== undefined) {
    return 'added'
  }

  if (beforeDependency !== undefined && afterDependency === undefined) {
    return 'removed'
  }

  if (beforeDependency === undefined || afterDependency === undefined) {
    return 'unchanged'
  }

  if (beforeDependency.kind !== afterDependency.kind) {
    return 'changed'
  }

  if (beforeDependency.kind === 'external' && afterDependency.kind === 'external') {
    return beforeDependency.specifier === afterDependency.specifier
      ? 'unchanged'
      : 'changed'
  }

  if (
    beforeDependency.kind === 'workspace' &&
    afterDependency.kind === 'workspace'
  ) {
    return beforeDependency.specifier === afterDependency.specifier &&
      beforeDependency.targetPath === afterDependency.targetPath
      ? 'unchanged'
      : 'changed'
  }

  return 'changed'
}

function toDiffState(
  dependency: ComparablePackageDependency,
): PackageDependencyDiffState {
  if (dependency.kind === 'external') {
    return {
      target: `${dependency.name}@${dependency.specifier}`,
      specifier: dependency.specifier,
    }
  }

  return dependency.specifier === undefined
    ? {
        target: dependency.targetPath,
      }
    : {
        target: dependency.targetPath,
        specifier: dependency.specifier,
      }
}

function hasVisibleChanges(node: PackageDependencyDiffNode): boolean {
  return node.change !== 'unchanged' || node.dependencies.length > 0
}

function resolveNodeChange(
  location: {
    readonly beforePath: string | undefined
    readonly afterPath: string | undefined
  },
  beforeNode: ComparablePackageDependencyNode | undefined,
  afterNode: ComparablePackageDependencyNode | undefined,
  dependencies: readonly PackageDependencyDiffDependency[],
): PackageDependencyChangeKind {
  if (beforeNode === undefined && afterNode !== undefined) {
    return 'added'
  }

  if (beforeNode !== undefined && afterNode === undefined) {
    return 'removed'
  }

  if (beforeNode === undefined || afterNode === undefined) {
    return 'unchanged'
  }

  if (location.beforePath !== location.afterPath) {
    return 'changed'
  }

  if (beforeNode.packageName !== afterNode.packageName) {
    return 'changed'
  }

  return dependencies.some((dependency) => dependency.change !== 'unchanged')
    ? 'changed'
    : 'unchanged'
}

function runGit(
  repositoryRoot: string,
  args: readonly string[],
  options: {
    readonly trim?: boolean
  } = {},
): string {
  const output = execFileSync('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
  })

  return options.trim === false ? output : output.trimEnd()
}

function getCommandErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown Git error'
  }

  const stderr = Reflect.get(error, 'stderr')

  if (typeof stderr === 'string' && stderr.trim().length > 0) {
    return stderr.trim()
  }

  if (Buffer.isBuffer(stderr) && stderr.byteLength > 0) {
    return stderr.toString('utf8').trim()
  }

  return error.message
}
