import fs from 'node:fs'
import path from 'node:path'

import type { PackageDependencyGraph } from '../../types/package-dependency-graph.js'
import type { PackageDependencyNode } from '../../types/package-dependency-node.js'
import type {
  ExternalPackageManifestDependency,
  PackageManifestDependency,
  WorkspacePackageManifestDependency,
} from '../../types/package-manifest-dependency.js'
import { toDisplayPath } from '../../utils/to-display-path.js'
import { BaseAnalyzer } from '../base.js'

interface PackageManifest {
  readonly name?: string
  readonly workspaces?: readonly string[] | WorkspaceConfig
  readonly dependencies?: Readonly<Record<string, string>>
}

interface WorkspaceConfig {
  readonly packages?: readonly string[]
}

interface WorkspacePackage {
  readonly name: string
  readonly packageDir: string
  readonly label: string
}

const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml'

export function analyzePackageDependencies(
  directory: string,
): PackageDependencyGraph {
  return new PackageDependencyAnalyzer(directory).analyze()
}

class PackageDependencyAnalyzer extends BaseAnalyzer<PackageDependencyGraph> {
  private readonly inputPath: string

  constructor(directory: string) {
    super(directory, {})
    this.inputPath = path.resolve(process.cwd(), directory)
  }

  protected doAnalyze(): PackageDependencyGraph {
    const inputDirectory = resolveInputDirectory(this.inputPath)
    const rootPackageDir = findNearestPackageDirectory(inputDirectory)
    const workspaceRootDir = findWorkspaceRoot(rootPackageDir) ?? rootPackageDir
    const workspacePackages = discoverWorkspacePackages(workspaceRootDir)
    const nodes = new Map<string, PackageDependencyNode>()

    visitPackage(rootPackageDir, workspaceRootDir, workspacePackages, nodes)

    return {
      repositoryRoot: workspaceRootDir,
      rootId: rootPackageDir,
      nodes,
    }
  }
}

function visitPackage(
  packageDir: string,
  repositoryRoot: string,
  workspacePackages: ReadonlyMap<string, WorkspacePackage>,
  nodes: Map<string, PackageDependencyNode>,
): void {
  if (nodes.has(packageDir)) {
    return
  }

  const manifest = readPackageManifest(packageDir)
  const packageName = resolvePackageName(manifest, packageDir)
  const dependencies =
    packageDir === repositoryRoot && workspacePackages.size > 0
      ? collectRepositoryRootDependencies(
          manifest,
          workspacePackages,
          repositoryRoot,
        )
      : collectManifestDependencies(manifest, workspacePackages, repositoryRoot)

  nodes.set(packageDir, {
    packageDir,
    packageName,
    dependencies,
  })

  dependencies.forEach((dependency) => {
    if (dependency.kind === 'workspace') {
      visitPackage(dependency.target, repositoryRoot, workspacePackages, nodes)
    }
  })
}

function resolveInputDirectory(resolvedPath: string): string {
  const stats = fs.existsSync(resolvedPath) ? fs.statSync(resolvedPath) : null

  if (stats === null) {
    throw new Error(`Directory does not exist: ${resolvedPath}`)
  }

  if (stats.isDirectory()) {
    return resolvedPath
  }

  if (stats.isFile() && path.basename(resolvedPath) === 'package.json') {
    return path.dirname(resolvedPath)
  }

  throw new Error(`Expected a package directory: ${resolvedPath}`)
}

function findNearestPackageDirectory(startDirectory: string): string {
  let currentDirectory = startDirectory

  while (true) {
    const packageJsonPath = path.join(currentDirectory, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      return currentDirectory
    }

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) {
      break
    }

    currentDirectory = parentDirectory
  }

  throw new Error(`No package.json found from ${startDirectory}`)
}

function findWorkspaceRoot(packageDir: string): string | undefined {
  let currentDirectory = packageDir

  while (true) {
    const packageJsonPath = path.join(currentDirectory, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      const manifest = readPackageManifest(currentDirectory)
      const workspacePatterns = resolveWorkspacePatterns(
        currentDirectory,
        manifest,
      )

      if (workspacePatterns.length > 0 && currentDirectory === packageDir) {
        return currentDirectory
      }

      if (
        workspacePatterns.length > 0 &&
        isWorkspaceMatch(currentDirectory, workspacePatterns, packageDir)
      ) {
        return currentDirectory
      }
    }

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) {
      return undefined
    }

    currentDirectory = parentDirectory
  }
}

function discoverWorkspacePackages(
  repositoryRoot: string,
): ReadonlyMap<string, WorkspacePackage> {
  const manifest = readPackageManifest(repositoryRoot)
  const workspacePatterns = resolveWorkspacePatterns(repositoryRoot, manifest)

  if (workspacePatterns.length === 0) {
    return new Map()
  }

  const workspacePackageDirs = new Set<string>()

  workspacePatterns.forEach((pattern) => {
    expandWorkspacePattern(repositoryRoot, pattern).forEach((packageDir) => {
      workspacePackageDirs.add(packageDir)
    })
  })

  const workspacePackages = new Map<string, WorkspacePackage>()

  Array.from(workspacePackageDirs)
    .sort((left, right) => left.localeCompare(right))
    .forEach((packageDir) => {
      const workspaceManifest = readPackageManifest(packageDir)
      const workspaceName = resolvePackageName(workspaceManifest, packageDir)

      if (workspacePackages.has(workspaceName)) {
        throw new Error(`Duplicate workspace package name: ${workspaceName}`)
      }

      workspacePackages.set(workspaceName, {
        name: workspaceName,
        packageDir,
        label: toDisplayPath(packageDir, repositoryRoot),
      })
    })

  return workspacePackages
}

function collectManifestDependencies(
  manifest: PackageManifest,
  workspacePackages: ReadonlyMap<string, WorkspacePackage>,
  repositoryRoot: string,
): readonly PackageManifestDependency[] {
  const dependencyEntries = Object.entries(manifest.dependencies ?? {})
  const workspaceDependencies: WorkspacePackageManifestDependency[] = []
  const externalDependencies: ExternalPackageManifestDependency[] = []

  dependencyEntries.forEach(([dependencyName, specifier]) => {
    const workspacePackage = workspacePackages.get(dependencyName)

    if (workspacePackage !== undefined) {
      workspaceDependencies.push({
        kind: 'workspace',
        name: dependencyName,
        specifier,
        target: workspacePackage.packageDir,
      })
      return
    }

    externalDependencies.push({
      kind: 'external',
      name: dependencyName,
      specifier,
    })
  })

  workspaceDependencies.sort((left, right) => {
    const leftLabel = toDisplayPath(left.target, repositoryRoot)
    const rightLabel = toDisplayPath(right.target, repositoryRoot)
    return leftLabel.localeCompare(rightLabel)
  })
  externalDependencies.sort((left, right) =>
    left.name.localeCompare(right.name),
  )

  return [...workspaceDependencies, ...externalDependencies]
}

function collectRepositoryRootDependencies(
  manifest: PackageManifest,
  workspacePackages: ReadonlyMap<string, WorkspacePackage>,
  _repositoryRoot: string,
): readonly PackageManifestDependency[] {
  const topLevelWorkspaceDependencies = Array.from(workspacePackages.values())
    .sort((left, right) => left.label.localeCompare(right.label))
    .map<WorkspacePackageManifestDependency>((workspacePackage) => ({
      kind: 'workspace',
      name: workspacePackage.name,
      target: workspacePackage.packageDir,
    }))

  const externalDependencies = Object.entries(manifest.dependencies ?? {})
    .filter(([dependencyName]) => !workspacePackages.has(dependencyName))
    .map<ExternalPackageManifestDependency>(([dependencyName, specifier]) => ({
      kind: 'external',
      name: dependencyName,
      specifier,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  return [...topLevelWorkspaceDependencies, ...externalDependencies]
}

function readPackageManifest(packageDir: string): PackageManifest {
  const packageJsonPath = path.join(packageDir, 'package.json')

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Missing package.json in ${packageDir}`)
  }

  const manifestText = fs.readFileSync(packageJsonPath, 'utf8')

  try {
    const parsed = JSON.parse(manifestText) as unknown

    if (!isRecord(parsed)) {
      throw new Error('package.json must contain an object')
    }

    return parsed as PackageManifest
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown JSON parse error'
    throw new Error(`Failed to read ${packageJsonPath}: ${message}`)
  }
}

function resolvePackageName(
  manifest: PackageManifest,
  packageDir: string,
): string {
  if (typeof manifest.name === 'string' && manifest.name.trim().length > 0) {
    return manifest.name
  }

  throw new Error(`Package at ${packageDir} is missing a valid name`)
}

function getWorkspacePatterns(manifest: PackageManifest): readonly string[] {
  if (Array.isArray(manifest.workspaces)) {
    return manifest.workspaces.filter(
      (pattern): pattern is string =>
        typeof pattern === 'string' && pattern.length > 0,
    )
  }

  if (
    isRecord(manifest.workspaces) &&
    Array.isArray(manifest.workspaces.packages)
  ) {
    return manifest.workspaces.packages.filter(
      (pattern): pattern is string =>
        typeof pattern === 'string' && pattern.length > 0,
    )
  }

  return []
}

function resolveWorkspacePatterns(
  repositoryRoot: string,
  manifest: PackageManifest,
): readonly string[] {
  const manifestPatterns = getWorkspacePatterns(manifest)
  if (manifestPatterns.length > 0) {
    return manifestPatterns
  }

  return readPnpmWorkspacePatterns(repositoryRoot)
}

function readPnpmWorkspacePatterns(repositoryRoot: string): readonly string[] {
  const pnpmWorkspacePath = path.join(repositoryRoot, PNPM_WORKSPACE_FILE)

  if (!fs.existsSync(pnpmWorkspacePath)) {
    return []
  }

  const fileContent = fs.readFileSync(pnpmWorkspacePath, 'utf8')
  const lines = fileContent.split(/\r?\n/)
  const patterns: string[] = []
  let inPackagesBlock = false

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
      continue
    }

    if (!inPackagesBlock) {
      if (trimmedLine === 'packages:') {
        inPackagesBlock = true
      }

      continue
    }

    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      break
    }

    if (!trimmedLine.startsWith('- ')) {
      continue
    }

    const pattern = unquoteWorkspacePattern(trimmedLine.slice(2).trim())

    if (pattern.length > 0) {
      patterns.push(pattern)
    }
  }

  return patterns
}

function unquoteWorkspacePattern(pattern: string): string {
  if (
    (pattern.startsWith('"') && pattern.endsWith('"')) ||
    (pattern.startsWith("'") && pattern.endsWith("'"))
  ) {
    return pattern.slice(1, -1)
  }

  return pattern
}

function isWorkspaceMatch(
  repositoryRoot: string,
  patterns: readonly string[],
  packageDir: string,
): boolean {
  return patterns.some((pattern) =>
    expandWorkspacePattern(repositoryRoot, pattern).includes(packageDir),
  )
}

function expandWorkspacePattern(
  repositoryRoot: string,
  pattern: string,
): string[] {
  const segments = normalizeWorkspacePattern(pattern)
  const matches = matchWorkspaceSegments(repositoryRoot, segments, 0)

  return matches.filter((packageDir) =>
    fs.existsSync(path.join(packageDir, 'package.json')),
  )
}

function normalizeWorkspacePattern(pattern: string): string[] {
  return pattern
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0 && segment !== '.')
}

function matchWorkspaceSegments(
  currentDirectory: string,
  segments: readonly string[],
  index: number,
): string[] {
  if (index >= segments.length) {
    return [currentDirectory]
  }

  const segment = segments[index]
  if (segment === undefined) {
    return [currentDirectory]
  }

  if (segment === '**') {
    const results = new Set<string>(
      matchWorkspaceSegments(currentDirectory, segments, index + 1),
    )

    listSubdirectories(currentDirectory).forEach((subdirectory) => {
      matchWorkspaceSegments(subdirectory, segments, index).forEach((match) => {
        results.add(match)
      })
    })

    return [...results]
  }

  const matcher = createWorkspaceSegmentMatcher(segment)
  const results: string[] = []

  listSubdirectories(currentDirectory).forEach((subdirectory) => {
    if (!matcher(path.basename(subdirectory))) {
      return
    }

    results.push(...matchWorkspaceSegments(subdirectory, segments, index + 1))
  })

  return results
}

function listSubdirectories(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== 'node_modules' &&
        entry.name !== '.git',
    )
    .map((entry) => path.join(directory, entry.name))
}

function createWorkspaceSegmentMatcher(
  segment: string,
): (name: string) => boolean {
  if (!segment.includes('*')) {
    return (name: string) => name === segment
  }

  const escapedSegment = escapeRegExp(segment).replaceAll('*', '[^/]*')
  const pattern = new RegExp(`^${escapedSegment}$`)

  return (name: string) => pattern.test(name)
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[|\\{}()[\]^$+?.]/g, '\\$&')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
