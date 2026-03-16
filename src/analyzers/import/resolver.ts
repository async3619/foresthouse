import { builtinModules } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

import type { DependencyEdge } from '../../types/dependency-edge.js'
import type { DependencyKind } from '../../types/dependency-kind.js'
import { isSourceCodeFile } from '../../utils/is-source-code-file.js'
import { normalizeFilePath } from '../../utils/normalize-file-path.js'
import type { ModuleReference } from './references.js'

const BUILTIN_MODULES = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
)

export interface ResolverConfigContext {
  readonly path?: string
  readonly compilerOptions: ts.CompilerOptions
}

export interface ResolveDependencyOptions {
  readonly cwd: string
  readonly entryConfigPath?: string
  readonly expandWorkspaces: boolean
  readonly projectOnly: boolean
  readonly getConfigForFile: (filePath: string) => ResolverConfigContext
}

export function resolveDependency(
  reference: ModuleReference,
  containingFile: string,
  options: ResolveDependencyOptions,
): DependencyEdge {
  const specifier = reference.specifier
  if (BUILTIN_MODULES.has(specifier)) {
    return createEdge(reference, 'builtin', specifier)
  }

  const containingConfig = options.getConfigForFile(containingFile)
  const host = createResolutionHost(containingConfig, options.cwd)
  const resolution = ts.resolveModuleName(
    specifier,
    containingFile,
    containingConfig.compilerOptions,
    host,
  ).resolvedModule

  if (resolution !== undefined) {
    const resolvedPath = normalizeFilePath(resolution.resolvedFileName)
    const realPath = resolveRealPath(resolvedPath)
    const sourcePath = pickSourcePath(resolvedPath, realPath)

    if (sourcePath !== undefined) {
      const boundary = classifyBoundary(specifier, sourcePath, options)
      if (boundary !== undefined) {
        return createEdge(reference, 'boundary', sourcePath, boundary)
      }

      if (
        !resolution.isExternalLibraryImport ||
        !isInsideNodeModules(sourcePath) ||
        (realPath !== undefined && !isInsideNodeModules(realPath))
      ) {
        return createEdge(reference, 'source', sourcePath)
      }
    }

    if (
      resolution.isExternalLibraryImport ||
      isInsideNodeModules(resolvedPath) ||
      (realPath !== undefined && isInsideNodeModules(realPath))
    ) {
      return createEdge(reference, 'external', specifier)
    }
  }

  if (!specifier.startsWith('.') && !path.isAbsolute(specifier)) {
    return createEdge(reference, 'external', specifier)
  }

  return createEdge(reference, 'missing', specifier)
}

function createEdge(
  reference: ModuleReference,
  kind: DependencyKind,
  target: string,
  boundary?: 'workspace' | 'project',
): DependencyEdge {
  return {
    specifier: reference.specifier,
    referenceKind: reference.referenceKind,
    isTypeOnly: reference.isTypeOnly,
    unused: reference.unused,
    kind,
    target,
    ...(boundary === undefined ? {} : { boundary }),
  }
}

function createResolutionHost(
  config: ResolverConfigContext,
  cwd: string,
): ts.ModuleResolutionHost {
  return {
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    directoryExists: ts.sys.directoryExists,
    getCurrentDirectory: () =>
      config.path === undefined ? cwd : path.dirname(config.path),
    getDirectories: ts.sys.getDirectories,
    ...(ts.sys.realpath === undefined ? {} : { realpath: ts.sys.realpath }),
  }
}

function resolveRealPath(resolvedPath: string): string | undefined {
  if (ts.sys.realpath === undefined) {
    return undefined
  }

  try {
    return normalizeFilePath(ts.sys.realpath(resolvedPath))
  } catch {
    return undefined
  }
}

function pickSourcePath(
  resolvedPath: string,
  realPath: string | undefined,
): string | undefined {
  const candidates = [realPath, resolvedPath]

  for (const candidate of candidates) {
    if (
      candidate !== undefined &&
      isSourceCodeFile(candidate) &&
      !candidate.endsWith('.d.ts')
    ) {
      return candidate
    }
  }

  return undefined
}

function classifyBoundary(
  specifier: string,
  sourcePath: string,
  options: ResolveDependencyOptions,
): 'workspace' | 'project' | undefined {
  const targetConfigPath = options.getConfigForFile(sourcePath).path
  const entryConfigPath = options.entryConfigPath

  if (
    options.projectOnly &&
    entryConfigPath !== undefined &&
    targetConfigPath !== entryConfigPath
  ) {
    return 'project'
  }

  if (
    !options.expandWorkspaces &&
    isWorkspaceLikeImport(specifier) &&
    entryConfigPath !== undefined &&
    targetConfigPath !== entryConfigPath
  ) {
    return 'workspace'
  }

  return undefined
}

function isWorkspaceLikeImport(specifier: string): boolean {
  return !specifier.startsWith('.') && !path.isAbsolute(specifier)
}

function isInsideNodeModules(filePath: string): boolean {
  return filePath.includes(`${path.sep}node_modules${path.sep}`)
}
