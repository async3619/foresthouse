import { execFileSync, execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type { ReactCliOptions } from '../../app/args.js'
import { resolveReactEntryFiles } from '../../app/react-entry-files.js'
import type { AnalyzeOptions } from '../../types/analyze-options.js'
import type { PackageDependencyChangeKind } from '../../types/package-dependency-change-kind.js'
import type { ReactSymbolKind } from '../../types/react-symbol-kind.js'
import type { ReactUsageDiffEdge } from '../../types/react-usage-diff-edge.js'
import type { ReactUsageDiffEntry } from '../../types/react-usage-diff-entry.js'
import type { ReactUsageDiffGraph } from '../../types/react-usage-diff-graph.js'
import type { ReactUsageDiffNode } from '../../types/react-usage-diff-node.js'
import type { ReactUsageEdge } from '../../types/react-usage-edge.js'
import type { ReactUsageEntry } from '../../types/react-usage-entry.js'
import type { ReactUsageFilter } from '../../types/react-usage-filter.js'
import type { ReactUsageGraph } from '../../types/react-usage-graph.js'
import type { ReactUsageNode } from '../../types/react-usage-node.js'
import { toDisplayPath } from '../../utils/to-display-path.js'
import { analyzeReactUsage } from './index.js'
import {
  getFilteredUsages,
  getReactUsageEntries,
  getReactUsageRoots,
} from './queries.js'

interface GitDiffComparison {
  readonly beforeTree: string
  readonly afterTree: string | undefined
}

interface ReactDiffAnalysisContext {
  readonly repositoryRoot: string
  readonly originalCwd: string
  readonly cwdWithinRepository: string
  readonly entryFile: string | undefined
  readonly nextjs: boolean
  readonly filter: ReactUsageFilter
  readonly includeBuiltins: boolean
  readonly analyzeOptions: AnalyzeOptions
}

interface ComparableReactGraph {
  readonly entriesByKey: ReadonlyMap<string, ComparableReactEntry>
  readonly rootIds: readonly string[]
  readonly nodes: ReadonlyMap<string, ComparableReactNode>
}

interface ComparableReactNode {
  readonly id: string
  readonly name: string
  readonly symbolKind: ReactSymbolKind
  readonly filePath: string
  readonly exportNames: readonly string[]
  readonly usagesByKey: ReadonlyMap<string, ComparableReactEdge>
}

interface ComparableReactEdge {
  readonly key: string
  readonly kind: ReactUsageEdge['kind']
  readonly targetId: string
  readonly referenceName: string
}

interface ComparableReactEntry {
  readonly key: string
  readonly targetId: string
  readonly referenceName: string
  readonly filePath: string
  readonly line: number
  readonly column: number
}

export function analyzeReactUsageDiff(
  options: ReactCliOptions,
): ReactUsageDiffGraph {
  const originalCwd = resolveOriginalCwd(options.cwd)
  const repositoryRoot = findGitRepositoryRoot(
    resolveDiffInputPath(options, originalCwd),
  )
  const comparison = resolveGitDiffComparison(
    repositoryRoot,
    options.diff ?? 'HEAD',
  )
  const context: ReactDiffAnalysisContext = {
    repositoryRoot,
    originalCwd,
    cwdWithinRepository: resolvePathWithinRepository(
      originalCwd,
      repositoryRoot,
      'Working directory',
    ),
    entryFile: options.entryFile,
    nextjs: options.nextjs,
    filter: options.filter,
    includeBuiltins: options.includeBuiltins,
    analyzeOptions: toAnalyzeOptions(options),
  }
  const [beforeGraph, afterGraph] = loadBothGraphs(context, comparison)

  if (beforeGraph === undefined && afterGraph === undefined) {
    throw new Error(
      'No React entry files found for the requested diff. Check the entry path or Next.js discovery roots.',
    )
  }

  const entries = diffEntries(beforeGraph, afterGraph)
  const roots =
    entries.length > 0
      ? entries.map((entry) => entry.node)
      : diffRoots(beforeGraph, afterGraph)

  return {
    kind: 'react-usage-diff',
    repositoryRoot,
    cwd: originalCwd,
    entries,
    roots,
  }
}

const GIT_EXEC_MAX_BUFFER = 64 * 1024 * 1024

function resolveOriginalCwd(cwd: string | undefined): string {
  return path.resolve(cwd ?? process.cwd())
}

function resolveDiffInputPath(
  options: ReactCliOptions,
  originalCwd: string,
): string {
  if (options.entryFile === undefined) {
    return originalCwd
  }

  return path.isAbsolute(options.entryFile)
    ? path.resolve(options.entryFile)
    : path.resolve(originalCwd, options.entryFile)
}

function toAnalyzeOptions(options: ReactCliOptions): AnalyzeOptions {
  return {
    ...(options.configPath === undefined
      ? {}
      : { configPath: options.configPath }),
    expandWorkspaces: options.expandWorkspaces,
    projectOnly: options.projectOnly,
    includeBuiltins: options.includeBuiltins,
  }
}


function loadBothGraphs(
  context: ReactDiffAnalysisContext,
  comparison: GitDiffComparison,
): [ComparableReactGraph | undefined, ComparableReactGraph | undefined] {
  const snapshotsToCleanup: string[] = []

  try {
    let beforeRoot: string
    let afterRoot: string

    if (comparison.afterTree === undefined) {
      beforeRoot = materializeGitTreeSnapshot(
        context.repositoryRoot,
        comparison.beforeTree,
      )
      snapshotsToCleanup.push(beforeRoot)
      afterRoot = context.repositoryRoot
    } else {
      ;[beforeRoot, afterRoot] = materializeTwoGitTreeSnapshots(
        context.repositoryRoot,
        comparison.beforeTree,
        comparison.afterTree,
      )
      snapshotsToCleanup.push(beforeRoot, afterRoot)
    }

    const beforeGraph = tryAnalyzeComparableReactGraph(context, beforeRoot)
    const afterGraph = tryAnalyzeComparableReactGraph(context, afterRoot)

    return [beforeGraph, afterGraph]
  } finally {
    for (const dir of snapshotsToCleanup) {
      spawn('rm', ['-rf', dir], { stdio: 'ignore', detached: true }).unref()
    }
  }
}

function tryAnalyzeComparableReactGraph(
  context: ReactDiffAnalysisContext,
  workingRoot: string,
): ComparableReactGraph | undefined {
  const snapshotCwd = resolveSnapshotCwd(
    workingRoot,
    context.cwdWithinRepository,
  )
  const entryFiles = resolveSnapshotEntryFiles(
    context,
    snapshotCwd,
    workingRoot,
  )

  if (entryFiles === undefined || entryFiles.length === 0) {
    return undefined
  }

  const graph = analyzeReactUsage(entryFiles, {
    ...context.analyzeOptions,
    cwd: snapshotCwd,
    ...(context.analyzeOptions.configPath === undefined
      ? {}
      : {
          configPath: resolveSnapshotConfigPath(
            context.analyzeOptions.configPath,
            workingRoot,
            context.repositoryRoot,
          ),
        }),
  })

  return toComparableGraph(
    graph,
    context.repositoryRoot,
    context.originalCwd,
    context.filter,
  )
}

function resolveSnapshotCwd(
  workingRoot: string,
  cwdWithinRepository: string,
): string {
  return cwdWithinRepository.length === 0
    ? workingRoot
    : path.join(workingRoot, cwdWithinRepository)
}

function resolveSnapshotEntryFiles(
  context: ReactDiffAnalysisContext,
  snapshotCwd: string,
  workingRoot: string,
): string[] | undefined {
  if (context.entryFile !== undefined) {
    const entryFile = resolveSnapshotEntryPath(
      context.entryFile,
      workingRoot,
      context.repositoryRoot,
    )

    return doesResolvedPathExist(entryFile, snapshotCwd)
      ? [entryFile]
      : undefined
  }

  if (!context.nextjs) {
    throw new Error(
      'Missing React entry file. Use `foresthouse react <entry-file>` or `foresthouse react --nextjs`.',
    )
  }

  try {
    return resolveReactEntryFiles({
      command: 'react',
      entryFile: undefined,
      diff: undefined,
      cwd: snapshotCwd,
      configPath: undefined,
      expandWorkspaces: true,
      projectOnly: false,
      json: false,
      filter: context.filter,
      nextjs: true,
      includeBuiltins: context.includeBuiltins,
    })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith('No Next.js page entries found.')
    ) {
      return undefined
    }

    throw error
  }
}

function resolveSnapshotEntryPath(
  entryFile: string,
  workingRoot: string,
  repositoryRoot: string,
): string {
  if (!path.isAbsolute(entryFile)) {
    return entryFile
  }

  const entryWithinRepository = resolvePathWithinRepository(
    entryFile,
    repositoryRoot,
    'React entry file',
  )

  return entryWithinRepository.length === 0
    ? workingRoot
    : path.join(workingRoot, entryWithinRepository)
}

function resolveSnapshotConfigPath(
  configPath: string,
  workingRoot: string,
  repositoryRoot: string,
): string {
  if (!path.isAbsolute(configPath)) {
    return configPath
  }

  const configWithinRepository = resolvePathWithinRepository(
    configPath,
    repositoryRoot,
    'TypeScript config',
  )

  return configWithinRepository.length === 0
    ? workingRoot
    : path.join(workingRoot, configWithinRepository)
}

function doesResolvedPathExist(entryFile: string, cwd: string): boolean {
  const resolvedEntryPath = path.isAbsolute(entryFile)
    ? entryFile
    : path.resolve(cwd, entryFile)

  return fs.existsSync(resolvedEntryPath)
}

function toComparableGraph(
  graph: ReactUsageGraph,
  _repositoryRoot: string,
  originalCwd: string,
  filter: ReactUsageFilter,
): ComparableReactGraph {
  const nodes = new Map<string, ComparableReactNode>()

  graph.nodes.forEach((node) => {
    const comparableNode = toComparableNode(node, graph, originalCwd, filter)
    nodes.set(comparableNode.id, comparableNode)
  })

  const entries = indexEntries(
    getReactUsageEntries(graph, filter).map((entry) =>
      toComparableEntry(entry, graph, originalCwd),
    ),
  )

  return {
    entriesByKey: new Map(entries.map((entry) => [entry.key, entry])),
    rootIds: getReactUsageRoots(graph, filter)
      .map((rootId) => {
        const node = graph.nodes.get(rootId)
        return node === undefined
          ? undefined
          : createComparableNodeId(node, graph.cwd)
      })
      .filter((rootId): rootId is string => rootId !== undefined),
    nodes,
  }
}

function toComparableNode(
  node: ReactUsageNode,
  graph: ReactUsageGraph,
  originalCwd: string,
  filter: ReactUsageFilter,
): ComparableReactNode {
  const usages = indexUsages(
    getFilteredUsages(node, graph, filter).map((usage) =>
      toComparableEdge(usage, graph),
    ),
  )

  return {
    id: createComparableNodeId(node, graph.cwd),
    name: node.name,
    symbolKind: node.kind,
    filePath: toDisplayFilePath(node.filePath, graph.cwd, originalCwd),
    exportNames: [...node.exportNames].sort(),
    usagesByKey: new Map(usages.map((usage) => [usage.key, usage])),
  }
}

function toComparableEdge(
  usage: ReactUsageEdge,
  graph: ReactUsageGraph,
): Omit<ComparableReactEdge, 'key'> {
  const targetNode = graph.nodes.get(usage.target)

  return {
    kind: usage.kind,
    targetId:
      targetNode === undefined
        ? usage.target
        : createComparableNodeId(targetNode, graph.cwd),
    referenceName: usage.referenceName,
  }
}

function toComparableEntry(
  entry: ReactUsageEntry,
  graph: ReactUsageGraph,
  originalCwd: string,
): Omit<ComparableReactEntry, 'key'> {
  const targetNode = graph.nodes.get(entry.target)

  return {
    targetId:
      targetNode === undefined
        ? entry.target
        : createComparableNodeId(targetNode, graph.cwd),
    referenceName: entry.referenceName,
    filePath: toDisplayFilePath(
      entry.location.filePath,
      graph.cwd,
      originalCwd,
    ),
    line: entry.location.line,
    column: entry.location.column,
  }
}

function indexUsages(
  usages: readonly Omit<ComparableReactEdge, 'key'>[],
): ComparableReactEdge[] {
  const counts = new Map<string, number>()

  return [...usages].sort(compareComparableEdgeState).map((usage) => {
    const signature = `${usage.kind}:${usage.targetId}`
    const occurrence = counts.get(signature) ?? 0
    counts.set(signature, occurrence + 1)

    return {
      ...usage,
      key: `${signature}#${occurrence}`,
    }
  })
}

function indexEntries(
  entries: readonly Omit<ComparableReactEntry, 'key'>[],
): ComparableReactEntry[] {
  const counts = new Map<string, number>()

  return [...entries].sort(compareComparableEntryState).map((entry) => {
    const signature = `${entry.filePath}:${entry.targetId}`
    const occurrence = counts.get(signature) ?? 0
    counts.set(signature, occurrence + 1)

    return {
      ...entry,
      key: `${signature}#${occurrence}`,
    }
  })
}

function createComparableNodeId(
  node: ReactUsageNode,
  analysisCwd: string,
): string {
  return `${node.kind}:${toComparablePath(node.filePath, analysisCwd)}#${node.name}`
}

function toComparablePath(filePath: string, analysisCwd: string): string {
  if (!path.isAbsolute(filePath)) {
    return normalizePathSeparators(filePath)
  }

  const relativePath = path.relative(
    fs.realpathSync.native(analysisCwd),
    fs.realpathSync.native(filePath),
  )
  if (relativePath === '') {
    return '.'
  }

  return normalizePathSeparators(relativePath)
}

function toDisplayFilePath(
  filePath: string,
  analysisCwd: string,
  originalCwd: string,
): string {
  if (!path.isAbsolute(filePath)) {
    return normalizePathSeparators(filePath)
  }

  const relativePath = path.relative(
    fs.realpathSync.native(analysisCwd),
    fs.realpathSync.native(filePath),
  )
  if (relativePath === '') {
    return '.'
  }

  return toDisplayPath(path.resolve(originalCwd, relativePath), originalCwd)
}

function diffEntries(
  beforeGraph: ComparableReactGraph | undefined,
  afterGraph: ComparableReactGraph | undefined,
): ReactUsageDiffEntry[] {
  const entryKeys = new Set<string>([
    ...Array.from(beforeGraph?.entriesByKey.keys() ?? []),
    ...Array.from(afterGraph?.entriesByKey.keys() ?? []),
  ])

  return Array.from(entryKeys)
    .sort((left, right) =>
      compareComparableEntryState(
        beforeGraph?.entriesByKey.get(left) ??
          afterGraph?.entriesByKey.get(left),
        beforeGraph?.entriesByKey.get(right) ??
          afterGraph?.entriesByKey.get(right),
      ),
    )
    .flatMap((entryKey) => {
      const beforeEntry = beforeGraph?.entriesByKey.get(entryKey)
      const afterEntry = afterGraph?.entriesByKey.get(entryKey)
      const node = diffNode(
        beforeEntry?.targetId,
        afterEntry?.targetId,
        beforeGraph,
        afterGraph,
        new Set<string>(),
      )
      const change = resolveEntryChange(beforeEntry, afterEntry)

      if (change === 'unchanged' && !hasVisibleNodeChanges(node)) {
        return []
      }

      const currentEntry = afterEntry ?? beforeEntry
      if (currentEntry === undefined) {
        return []
      }

      return [
        {
          key: currentEntry.key,
          change,
          targetId: node.id,
          referenceName:
            afterEntry?.referenceName ??
            beforeEntry?.referenceName ??
            node.name,
          ...(beforeEntry === undefined
            ? {}
            : {
                beforeReferenceName: beforeEntry.referenceName,
                beforeFilePath: beforeEntry.filePath,
                beforeLine: beforeEntry.line,
                beforeColumn: beforeEntry.column,
              }),
          ...(afterEntry === undefined
            ? {}
            : {
                afterReferenceName: afterEntry.referenceName,
                afterFilePath: afterEntry.filePath,
                afterLine: afterEntry.line,
                afterColumn: afterEntry.column,
              }),
          node,
        },
      ]
    })
}

function diffRoots(
  beforeGraph: ComparableReactGraph | undefined,
  afterGraph: ComparableReactGraph | undefined,
): ReactUsageDiffNode[] {
  const rootIds = new Set<string>([
    ...Array.from(beforeGraph?.rootIds ?? []),
    ...Array.from(afterGraph?.rootIds ?? []),
  ])

  return Array.from(rootIds)
    .sort((left, right) =>
      compareComparableNodeState(
        beforeGraph?.nodes.get(left) ?? afterGraph?.nodes.get(left),
        beforeGraph?.nodes.get(right) ?? afterGraph?.nodes.get(right),
      ),
    )
    .flatMap((rootId) => {
      const node = diffNode(
        beforeGraph?.nodes.has(rootId) === true ? rootId : undefined,
        afterGraph?.nodes.has(rootId) === true ? rootId : undefined,
        beforeGraph,
        afterGraph,
        new Set<string>(),
      )

      return hasVisibleNodeChanges(node) ? [node] : []
    })
}

function diffNode(
  beforeNodeId: string | undefined,
  afterNodeId: string | undefined,
  beforeGraph: ComparableReactGraph | undefined,
  afterGraph: ComparableReactGraph | undefined,
  ancestry: ReadonlySet<string>,
): ReactUsageDiffNode {
  const beforeNode =
    beforeNodeId === undefined
      ? undefined
      : beforeGraph?.nodes.get(beforeNodeId)
  const afterNode =
    afterNodeId === undefined ? undefined : afterGraph?.nodes.get(afterNodeId)

  if (beforeNode === undefined && afterNode === undefined) {
    throw new Error('Unable to resolve React diff node.')
  }

  const ancestryKey = `${beforeNodeId ?? ''}->${afterNodeId ?? ''}`
  if (ancestry.has(ancestryKey)) {
    const node = afterNode ?? beforeNode
    if (node === undefined) {
      throw new Error('Unable to resolve circular React diff node.')
    }

    return {
      id: node.id,
      name: node.name,
      symbolKind: node.symbolKind,
      circular: true,
      filePath: node.filePath,
      change: 'unchanged',
      exportNames: node.exportNames,
      usages: [],
    }
  }

  const nextAncestry = new Set(ancestry)
  nextAncestry.add(ancestryKey)

  const usages = collectUsageDiffs(
    beforeNode,
    afterNode,
    beforeGraph,
    afterGraph,
    nextAncestry,
  )
  const directChange = resolveNodeDirectChange(beforeNode, afterNode)
  const node = afterNode ?? beforeNode

  if (node === undefined) {
    throw new Error('Unable to resolve React diff node.')
  }

  return {
    id: node.id,
    name: node.name,
    symbolKind: node.symbolKind,
    filePath: node.filePath,
    change:
      directChange === 'unchanged' && usages.length > 0
        ? 'changed'
        : directChange,
    exportNames: node.exportNames,
    ...(beforeNode === undefined
      ? {}
      : { beforeExportNames: beforeNode.exportNames }),
    ...(afterNode === undefined
      ? {}
      : { afterExportNames: afterNode.exportNames }),
    usages,
  }
}

function collectUsageDiffs(
  beforeNode: ComparableReactNode | undefined,
  afterNode: ComparableReactNode | undefined,
  beforeGraph: ComparableReactGraph | undefined,
  afterGraph: ComparableReactGraph | undefined,
  ancestry: ReadonlySet<string>,
): ReactUsageDiffEdge[] {
  const usageKeys = new Set<string>([
    ...Array.from(beforeNode?.usagesByKey.keys() ?? []),
    ...Array.from(afterNode?.usagesByKey.keys() ?? []),
  ])

  return Array.from(usageKeys)
    .sort((left, right) =>
      compareComparableEdgeState(
        beforeNode?.usagesByKey.get(left) ?? afterNode?.usagesByKey.get(left),
        beforeNode?.usagesByKey.get(right) ?? afterNode?.usagesByKey.get(right),
      ),
    )
    .flatMap((usageKey) => {
      const beforeUsage = beforeNode?.usagesByKey.get(usageKey)
      const afterUsage = afterNode?.usagesByKey.get(usageKey)
      const node = diffNode(
        beforeUsage?.targetId,
        afterUsage?.targetId,
        beforeGraph,
        afterGraph,
        ancestry,
      )
      const change = resolveEdgeChange(beforeUsage, afterUsage)

      if (change === 'unchanged' && !hasVisibleNodeChanges(node)) {
        return []
      }

      return [
        {
          key: afterUsage?.key ?? beforeUsage?.key ?? usageKey,
          kind: afterUsage?.kind ?? beforeUsage?.kind ?? 'render',
          change,
          targetId: node.id,
          referenceName:
            afterUsage?.referenceName ??
            beforeUsage?.referenceName ??
            node.name,
          ...(beforeUsage === undefined
            ? {}
            : { beforeReferenceName: beforeUsage.referenceName }),
          ...(afterUsage === undefined
            ? {}
            : { afterReferenceName: afterUsage.referenceName }),
          node,
        },
      ]
    })
}

function resolveEntryChange(
  beforeEntry: ComparableReactEntry | undefined,
  afterEntry: ComparableReactEntry | undefined,
): PackageDependencyChangeKind {
  if (beforeEntry === undefined && afterEntry !== undefined) {
    return 'added'
  }

  if (beforeEntry !== undefined && afterEntry === undefined) {
    return 'removed'
  }

  if (beforeEntry === undefined || afterEntry === undefined) {
    return 'unchanged'
  }

  return beforeEntry.targetId === afterEntry.targetId &&
    beforeEntry.referenceName === afterEntry.referenceName &&
    beforeEntry.filePath === afterEntry.filePath &&
    beforeEntry.line === afterEntry.line &&
    beforeEntry.column === afterEntry.column
    ? 'unchanged'
    : 'changed'
}

function resolveNodeDirectChange(
  beforeNode: ComparableReactNode | undefined,
  afterNode: ComparableReactNode | undefined,
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

  return beforeNode.name === afterNode.name &&
    beforeNode.symbolKind === afterNode.symbolKind &&
    beforeNode.filePath === afterNode.filePath &&
    areStringArraysEqual(beforeNode.exportNames, afterNode.exportNames)
    ? 'unchanged'
    : 'changed'
}

function resolveEdgeChange(
  beforeUsage: ComparableReactEdge | undefined,
  afterUsage: ComparableReactEdge | undefined,
): PackageDependencyChangeKind {
  if (beforeUsage === undefined && afterUsage !== undefined) {
    return 'added'
  }

  if (beforeUsage !== undefined && afterUsage === undefined) {
    return 'removed'
  }

  if (beforeUsage === undefined || afterUsage === undefined) {
    return 'unchanged'
  }

  return beforeUsage.kind === afterUsage.kind &&
    beforeUsage.targetId === afterUsage.targetId &&
    beforeUsage.referenceName === afterUsage.referenceName
    ? 'unchanged'
    : 'changed'
}

function hasVisibleNodeChanges(node: ReactUsageDiffNode): boolean {
  return node.change !== 'unchanged' || node.usages.length > 0
}

function compareComparableNodeState(
  left: ComparableReactNode | undefined,
  right: ComparableReactNode | undefined,
): number {
  return (
    (left?.filePath ?? '').localeCompare(right?.filePath ?? '') ||
    (left?.name ?? '').localeCompare(right?.name ?? '') ||
    (left?.symbolKind ?? '').localeCompare(right?.symbolKind ?? '')
  )
}

function compareComparableEdgeState(
  left: Omit<ComparableReactEdge, 'key'> | ComparableReactEdge | undefined,
  right: Omit<ComparableReactEdge, 'key'> | ComparableReactEdge | undefined,
): number {
  return (
    (left?.targetId ?? '').localeCompare(right?.targetId ?? '') ||
    (left?.referenceName ?? '').localeCompare(right?.referenceName ?? '') ||
    (left?.kind ?? '').localeCompare(right?.kind ?? '')
  )
}

function compareComparableEntryState(
  left: Omit<ComparableReactEntry, 'key'> | ComparableReactEntry | undefined,
  right: Omit<ComparableReactEntry, 'key'> | ComparableReactEntry | undefined,
): number {
  return (
    (left?.filePath ?? '').localeCompare(right?.filePath ?? '') ||
    (left?.line ?? 0) - (right?.line ?? 0) ||
    (left?.column ?? 0) - (right?.column ?? 0) ||
    (left?.referenceName ?? '').localeCompare(right?.referenceName ?? '') ||
    (left?.targetId ?? '').localeCompare(right?.targetId ?? '')
  )
}

function areStringArraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function resolvePathWithinRepository(
  resolvedPath: string,
  repositoryRoot: string,
  label: string,
): string {
  const absolutePath = path.resolve(resolvedPath)
  const existingPath = findNearestExistingPath(absolutePath)
  const existingRealPath = fs.realpathSync.native(existingPath)
  const repositoryRealPath = fs.realpathSync.native(repositoryRoot)
  const relativeFromExistingPath = path.relative(existingPath, absolutePath)
  const relativePath = path.normalize(
    path.join(
      path.relative(repositoryRealPath, existingRealPath),
      relativeFromExistingPath,
    ),
  )

  if (relativePath === '') {
    return ''
  }

  if (relativePath.startsWith('..')) {
    throw new Error(
      `${label} must be inside the Git repository when using --diff.`,
    )
  }

  return normalizePathSeparators(relativePath)
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

function materializeGitTreeSnapshot(
  repositoryRoot: string,
  tree: string,
): string {
  const snapshotRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'foresthouse-react-diff-'),
  )

  execSync(
    `git -C ${JSON.stringify(repositoryRoot)} archive --format=tar ${tree} | tar -x -C ${JSON.stringify(snapshotRoot)}`,
    {
      maxBuffer: GIT_EXEC_MAX_BUFFER,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  return snapshotRoot
}

function materializeTwoGitTreeSnapshots(
  repositoryRoot: string,
  beforeTree: string,
  afterTree: string,
): [string, string] {
  // 1. Materialize the after tree fully
  const afterSnap = materializeGitTreeSnapshot(repositoryRoot, afterTree)

  // 2. Try CoW clone + diff overlay for the before tree
  try {
    const beforeSnap = cloneSnapshotWithOverlay(
      repositoryRoot,
      afterSnap,
      beforeTree,
      afterTree,
    )
    return [beforeSnap, afterSnap]
  } catch {
    // CoW not supported — fall back to full materialization
    const beforeSnap = materializeGitTreeSnapshot(repositoryRoot, beforeTree)
    return [beforeSnap, afterSnap]
  }
}

function cloneSnapshotWithOverlay(
  repositoryRoot: string,
  sourceSnap: string,
  targetTree: string,
  sourceTree: string,
): string {
  const targetSnap = fs.mkdtempSync(
    path.join(os.tmpdir(), 'foresthouse-react-diff-'),
  )
  fs.rmSync(targetSnap, { recursive: true })

  // CoW clone (APFS on macOS, reflink on Btrfs/XFS)
  if (process.platform === 'darwin') {
    execFileSync('cp', ['-cR', sourceSnap, targetSnap], { stdio: 'ignore' })
  } else {
    execFileSync('cp', ['-a', '--reflink=auto', sourceSnap, targetSnap], {
      stdio: 'ignore',
    })
  }

  // Find changed files between the two trees
  const diffOutput = execFileSync(
    'git',
    [
      '-C',
      repositoryRoot,
      'diff',
      '--name-status',
      '--no-renames',
      '-z',
      targetTree,
      sourceTree,
    ],
    { maxBuffer: GIT_EXEC_MAX_BUFFER, encoding: 'utf8' },
  )

  if (diffOutput.length === 0) {
    return targetSnap
  }

  // Parse null-separated output: status\0path\0status\0path\0...
  const parts = diffOutput.split('\0')
  const filesToDelete: string[] = []
  const filesToRestore: string[] = []

  for (let i = 0; i + 1 < parts.length; i += 2) {
    const status = parts[i]
    const file = parts[i + 1]

    if (status === 'A') {
      // Added in source (after) — doesn't exist in target (before)
      filesToDelete.push(file)
    } else if (status === 'D' || status === 'M') {
      // Deleted or modified in source — restore target (before) version
      filesToRestore.push(file)
    }
  }

  for (const file of filesToDelete) {
    fs.rmSync(path.join(targetSnap, file), { force: true })
  }

  if (filesToRestore.length > 0) {
    // Extract only the changed files from the before tree
    const archive = execFileSync(
      'git',
      ['-C', repositoryRoot, 'archive', '--format=tar', targetTree, '--', ...filesToRestore],
      { maxBuffer: GIT_EXEC_MAX_BUFFER },
    )
    execFileSync('tar', ['-x', '-C', targetSnap], { input: archive })
  }

  return targetSnap
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
    maxBuffer: GIT_EXEC_MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
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

function normalizePathSeparators(filePath: string): string {
  return filePath.split(path.sep).join('/')
}
