import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

import { createModuleResolutionHost } from './program.js'

const workspaceRootCache = new Map<string, string | undefined>()
const workspacePackageCache = new Map<string, ReadonlyMap<string, string>>()

export interface LoadedConfig {
  readonly path?: string
  readonly compilerOptions: ts.CompilerOptions
}

export function loadCompilerOptions(
  searchFrom: string,
  explicitConfigPath?: string,
): LoadedConfig {
  const configPath =
    explicitConfigPath === undefined
      ? findNearestConfig(searchFrom)
      : path.resolve(searchFrom, explicitConfigPath)

  if (configPath === undefined) {
    return {
      compilerOptions: defaultCompilerOptions(),
    }
  }

  let fatalDiagnostic: ts.Diagnostic | undefined
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    defaultCompilerOptions(),
    createParseConfigHost(configPath, (diagnostic) => {
      fatalDiagnostic = diagnostic
    }),
  )

  if (parsed === undefined) {
    const diagnostic = fatalDiagnostic
    if (diagnostic === undefined) {
      throw new Error(`Failed to parse TypeScript config at ${configPath}.`)
    }

    throw new Error(
      `Failed to read TypeScript config at ${configPath}: ${formatDiagnostic(
        diagnostic,
      )}`,
    )
  }

  if (parsed.errors.length > 0) {
    const [firstError] = parsed.errors
    if (firstError === undefined) {
      throw new Error(`Failed to parse TypeScript config at ${configPath}.`)
    }

    throw new Error(
      `Failed to parse TypeScript config at ${configPath}: ${formatDiagnostic(
        firstError,
      )}`,
    )
  }

  return {
    path: configPath,
    compilerOptions: parsed.options,
  }
}

function findNearestConfig(searchFrom: string): string | undefined {
  let currentDirectory = path.resolve(searchFrom)

  while (true) {
    if (!isInsideNodeModules(currentDirectory)) {
      const tsconfigPath = path.join(currentDirectory, 'tsconfig.json')
      if (ts.sys.fileExists(tsconfigPath)) {
        return tsconfigPath
      }

      const jsconfigPath = path.join(currentDirectory, 'jsconfig.json')
      if (ts.sys.fileExists(jsconfigPath)) {
        return jsconfigPath
      }
    }

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) {
      return undefined
    }

    currentDirectory = parentDirectory
  }
}

function createParseConfigHost(
  configPath: string,
  onUnRecoverableConfigFileDiagnostic: (diagnostic: ts.Diagnostic) => void,
): ts.ParseConfigFileHost {
  const rewrittenConfigs = new Map<string, string>()

  return {
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    fileExists: ts.sys.fileExists,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getCurrentDirectory: () => path.dirname(configPath),
    getDirectories: ts.sys.getDirectories,
    onUnRecoverableConfigFileDiagnostic,
    readFile(filePath) {
      const normalizedPath = path.resolve(filePath)
      const cachedText = rewrittenConfigs.get(normalizedPath)
      if (cachedText !== undefined) {
        return cachedText
      }

      const fileText = ts.sys.readFile(normalizedPath)
      if (fileText === undefined) {
        return undefined
      }

      const rewrittenText = rewriteConfigExtends(
        normalizedPath,
        fileText,
        rewrittenConfigs,
      )
      rewrittenConfigs.set(normalizedPath, rewrittenText)
      return rewrittenText
    },
    ...(ts.sys.realpath === undefined ? {} : { realpath: ts.sys.realpath }),
  }
}

function rewriteConfigExtends(
  configPath: string,
  fileText: string,
  rewrittenConfigs: Map<string, string>,
): string {
  const parsed = ts.parseConfigFileTextToJson(configPath, fileText)
  if (parsed.error !== undefined || !isRecord(parsed.config)) {
    return fileText
  }

  const rewrittenConfig = rewriteExtendsField(configPath, parsed.config)
  if (rewrittenConfig === parsed.config) {
    return fileText
  }

  const rewrittenText = `${JSON.stringify(rewrittenConfig, null, 2)}\n`
  rewrittenConfigs.set(configPath, rewrittenText)
  return rewrittenText
}

function rewriteExtendsField(
  configPath: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const extendsField = config.extends
  if (typeof extendsField === 'string') {
    const resolved = resolveExtendsSpecifier(configPath, extendsField)
    if (resolved === extendsField) {
      return config
    }

    return {
      ...config,
      extends: resolved,
    }
  }

  if (!Array.isArray(extendsField)) {
    return config
  }

  let changed = false
  const rewrittenExtends = extendsField.map((value) => {
    if (typeof value !== 'string') {
      return value
    }

    const resolved = resolveExtendsSpecifier(configPath, value)
    if (resolved !== value) {
      changed = true
    }

    return resolved
  })

  if (!changed) {
    return config
  }

  return {
    ...config,
    extends: rewrittenExtends,
  }
}

function resolveExtendsSpecifier(
  configPath: string,
  specifier: string,
): string {
  if (isPathLikeSpecifier(specifier)) {
    return specifier
  }

  const resolvedWithNodeModules = resolveConfigModuleSpecifier(
    configPath,
    specifier,
  )
  if (resolvedWithNodeModules !== undefined) {
    return resolvedWithNodeModules
  }

  const workspaceConfigPath = resolveWorkspaceConfigSpecifier(
    path.dirname(configPath),
    specifier,
  )
  return workspaceConfigPath ?? specifier
}

function resolveConfigModuleSpecifier(
  configPath: string,
  specifier: string,
): string | undefined {
  const resolution = ts.resolveModuleName(
    specifier,
    configPath,
    defaultCompilerOptions(),
    createModuleResolutionHost(path.dirname(configPath)),
  ).resolvedModule

  return resolution?.resolvedFileName
}

function resolveWorkspaceConfigSpecifier(
  directory: string,
  specifier: string,
): string | undefined {
  const workspaceRoot = findWorkspaceRoot(directory)
  if (workspaceRoot === undefined) {
    return undefined
  }

  const { packageName, subpath } = parsePackageSpecifier(specifier)
  if (packageName === undefined) {
    return undefined
  }

  const packageDir = discoverWorkspacePackages(workspaceRoot).get(packageName)
  if (packageDir === undefined) {
    return undefined
  }

  if (subpath === undefined || subpath.length === 0) {
    return resolveWorkspacePackageEntry(packageDir)
  }

  return resolveExistingPath(path.join(packageDir, subpath))
}

function resolveWorkspacePackageEntry(packageDir: string): string | undefined {
  const manifest = readPackageManifest(packageDir)

  if (typeof manifest.main === 'string' && manifest.main.length > 0) {
    const resolvedMain = resolveExistingPath(
      path.join(packageDir, manifest.main),
    )
    if (resolvedMain !== undefined) {
      return resolvedMain
    }
  }

  return resolveExistingPath(path.join(packageDir, 'tsconfig.json'))
}

function resolveExistingPath(candidatePath: string): string | undefined {
  const normalizedPath = path.resolve(candidatePath)
  if (fs.existsSync(normalizedPath)) {
    return normalizedPath
  }

  if (path.extname(normalizedPath).length === 0) {
    const jsonPath = `${normalizedPath}.json`
    if (fs.existsSync(jsonPath)) {
      return jsonPath
    }
  }

  return undefined
}

function defaultCompilerOptions(): ts.CompilerOptions {
  return {
    allowJs: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ESNext,
    resolveJsonModule: true,
    esModuleInterop: true,
  }
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
}

interface PackageManifest {
  readonly main?: string
  readonly name?: string
  readonly workspaces?: readonly string[] | WorkspaceConfig
}

interface WorkspaceConfig {
  readonly packages?: readonly string[]
}

function findWorkspaceRoot(startDirectory: string): string | undefined {
  const cachedWorkspaceRoot = workspaceRootCache.get(startDirectory)
  if (
    cachedWorkspaceRoot !== undefined ||
    workspaceRootCache.has(startDirectory)
  ) {
    return cachedWorkspaceRoot
  }

  let currentDirectory = path.resolve(startDirectory)
  const traversedDirectories: string[] = []

  while (true) {
    traversedDirectories.push(currentDirectory)
    if (hasWorkspaceConfig(currentDirectory)) {
      traversedDirectories.forEach((directory) => {
        workspaceRootCache.set(directory, currentDirectory)
      })
      return currentDirectory
    }

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) {
      traversedDirectories.forEach((directory) => {
        workspaceRootCache.set(directory, undefined)
      })
      return undefined
    }

    currentDirectory = parentDirectory
  }
}

function hasWorkspaceConfig(directory: string): boolean {
  if (fs.existsSync(path.join(directory, 'pnpm-workspace.yaml'))) {
    return true
  }

  const packageJsonPath = path.join(directory, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    return false
  }

  return getWorkspacePatterns(readPackageManifest(directory)).length > 0
}

function discoverWorkspacePackages(
  workspaceRoot: string,
): ReadonlyMap<string, string> {
  const cachedPackages = workspacePackageCache.get(workspaceRoot)
  if (cachedPackages !== undefined) {
    return cachedPackages
  }

  const workspacePatterns = resolveWorkspacePatterns(
    workspaceRoot,
    readPackageManifest(workspaceRoot),
  )
  const workspacePackages = new Map<string, string>()

  workspacePatterns.forEach((pattern) => {
    expandWorkspacePattern(workspaceRoot, pattern).forEach((packageDir) => {
      const manifest = readPackageManifest(packageDir)
      if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
        return
      }

      workspacePackages.set(manifest.name, packageDir)
    })
  })

  workspacePackageCache.set(workspaceRoot, workspacePackages)
  return workspacePackages
}

function readPackageManifest(packageDir: string): PackageManifest {
  const manifestPath = path.join(packageDir, 'package.json')
  const manifestText = fs.readFileSync(manifestPath, 'utf8')
  return JSON.parse(manifestText) as PackageManifest
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
  workspaceRoot: string,
  manifest: PackageManifest,
): readonly string[] {
  const manifestPatterns = getWorkspacePatterns(manifest)
  if (manifestPatterns.length > 0) {
    return manifestPatterns
  }

  return readPnpmWorkspacePatterns(workspaceRoot)
}

function readPnpmWorkspacePatterns(workspaceRoot: string): readonly string[] {
  const workspacePath = path.join(workspaceRoot, 'pnpm-workspace.yaml')
  if (!fs.existsSync(workspacePath)) {
    return []
  }

  const fileContent = fs.readFileSync(workspacePath, 'utf8')
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

function expandWorkspacePattern(
  workspaceRoot: string,
  pattern: string,
): string[] {
  const segments = pattern
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0 && segment !== '.')

  return matchWorkspaceSegments(workspaceRoot, segments, 0).filter(
    (packageDir) => fs.existsSync(path.join(packageDir, 'package.json')),
  )
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

  const escapedSegment = segment.replaceAll(/[|\\{}()[\]^$+?.]/g, '\\$&')
  const pattern = new RegExp(`^${escapedSegment.replaceAll('*', '[^/]*')}$`)

  return (name: string) => pattern.test(name)
}

function parsePackageSpecifier(specifier: string): {
  packageName: string | undefined
  subpath?: string
} {
  const segments = specifier.split('/')
  if (segments.length === 0) {
    return { packageName: undefined }
  }

  if (specifier.startsWith('@')) {
    const scope = segments[0]
    const name = segments[1]
    if (scope === undefined || name === undefined) {
      return { packageName: undefined }
    }

    return {
      packageName: `${scope}/${name}`,
      subpath: segments.slice(2).join('/'),
    }
  }

  return {
    packageName: segments[0],
    subpath: segments.slice(1).join('/'),
  }
}

function isPathLikeSpecifier(specifier: string): boolean {
  return (
    path.isAbsolute(specifier) ||
    specifier.startsWith('./') ||
    specifier.startsWith('../')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isInsideNodeModules(filePath: string): boolean {
  return filePath.includes(`${path.sep}node_modules${path.sep}`)
}
