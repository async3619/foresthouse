import { builtinModules } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

import type { DependencyEdge, DependencyKind } from '../../types.js'
import { isSourceCodeFile } from '../../utils/is-source-code-file.js'
import { normalizeFilePath } from '../../utils/normalize-file-path.js'
import type { ModuleReference } from './references.js'

const BUILTIN_MODULES = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
)

export function resolveDependency(
  reference: ModuleReference,
  containingFile: string,
  compilerOptions: ts.CompilerOptions,
  host: ts.ModuleResolutionHost,
): DependencyEdge {
  const specifier = reference.specifier
  if (BUILTIN_MODULES.has(specifier)) {
    return createEdge(reference, 'builtin', specifier)
  }

  const resolution = ts.resolveModuleName(
    specifier,
    containingFile,
    compilerOptions,
    host,
  ).resolvedModule

  if (resolution !== undefined) {
    const resolvedPath = normalizeFilePath(resolution.resolvedFileName)
    if (
      resolution.isExternalLibraryImport ||
      resolvedPath.includes(`${path.sep}node_modules${path.sep}`)
    ) {
      return createEdge(reference, 'external', specifier)
    }

    if (isSourceCodeFile(resolvedPath) && !resolvedPath.endsWith('.d.ts')) {
      return createEdge(reference, 'source', resolvedPath)
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
): DependencyEdge {
  return {
    specifier: reference.specifier,
    referenceKind: reference.referenceKind,
    isTypeOnly: reference.isTypeOnly,
    unused: reference.unused,
    kind,
    target,
  }
}
