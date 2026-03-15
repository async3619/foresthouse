import fs from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

import { loadCompilerOptions } from './config.js'
import {
  isSourceCodeFile,
  normalizeFilePath,
  toDisplayPath,
} from './path-utils.js'
import type {
  AnalyzeOptions,
  DependencyEdge,
  DependencyGraph,
  DependencyKind,
  ReferenceKind,
  SourceModuleNode,
} from './types.js'

interface ModuleReference {
  readonly specifier: string
  readonly referenceKind: ReferenceKind
  readonly isTypeOnly: boolean
}

const BUILTIN_MODULES = new Set(
  builtinModules.flatMap((name) => [name, `node:${name}`]),
)

export function analyzeDependencies(
  entryFile: string,
  options: AnalyzeOptions = {},
): DependencyGraph {
  const cwd = path.resolve(options.cwd ?? process.cwd())
  const resolvedEntryPath = resolveExistingPath(cwd, entryFile)
  const { compilerOptions, path: configPath } = loadCompilerOptions(
    path.dirname(resolvedEntryPath),
    options.configPath,
  )

  const host: ts.ModuleResolutionHost = {
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    directoryExists: ts.sys.directoryExists,
    getCurrentDirectory: () => cwd,
    getDirectories: ts.sys.getDirectories,
    ...(ts.sys.realpath === undefined ? {} : { realpath: ts.sys.realpath }),
  }

  const nodes = new Map<string, SourceModuleNode>()
  visitFile(resolvedEntryPath, compilerOptions, host, nodes)

  return {
    cwd,
    entryId: resolvedEntryPath,
    nodes,
    ...(configPath === undefined ? {} : { configPath }),
  }
}

export function graphToSerializableTree(graph: DependencyGraph): object {
  const visited = new Set<string>()
  return serializeNode(graph.entryId, graph, visited)
}

function serializeNode(
  filePath: string,
  graph: DependencyGraph,
  visited: Set<string>,
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

  visited.add(filePath)

  const dependencies = node.dependencies.map((dependency) => {
    if (dependency.kind !== 'source') {
      return {
        specifier: dependency.specifier,
        referenceKind: dependency.referenceKind,
        isTypeOnly: dependency.isTypeOnly,
        kind: dependency.kind,
        target:
          dependency.kind === 'missing'
            ? dependency.target
            : toDisplayPath(dependency.target, graph.cwd),
      }
    }

    return {
      specifier: dependency.specifier,
      referenceKind: dependency.referenceKind,
      isTypeOnly: dependency.isTypeOnly,
      kind: dependency.kind,
      target: toDisplayPath(dependency.target, graph.cwd),
      node: serializeNode(dependency.target, graph, new Set(visited)),
    }
  })

  return {
    path: displayPath,
    kind: filePath === graph.entryId ? 'entry' : 'source',
    dependencies,
  }
}

function visitFile(
  filePath: string,
  compilerOptions: ts.CompilerOptions,
  host: ts.ModuleResolutionHost,
  nodes: Map<string, SourceModuleNode>,
): void {
  const normalizedPath = normalizeFilePath(filePath)
  if (nodes.has(normalizedPath)) {
    return
  }

  const sourceText = fs.readFileSync(normalizedPath, 'utf8')
  const sourceFile = ts.createSourceFile(
    normalizedPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(normalizedPath),
  )

  const references = collectModuleReferences(sourceFile)
  const dependencies = references.map((reference) =>
    resolveDependency(reference, normalizedPath, compilerOptions, host),
  )

  nodes.set(normalizedPath, {
    id: normalizedPath,
    dependencies,
  })

  for (const dependency of dependencies) {
    if (dependency.kind === 'source') {
      visitFile(dependency.target, compilerOptions, host, nodes)
    }
  }
}

function collectModuleReferences(sourceFile: ts.SourceFile): ModuleReference[] {
  const references: ModuleReference[] = []
  const seen = new Set<string>()

  function addReference(
    specifier: string,
    referenceKind: ReferenceKind,
    isTypeOnly: boolean,
  ): void {
    const key = `${referenceKind}:${isTypeOnly ? 'type' : 'value'}:${specifier}`
    if (seen.has(key)) {
      return
    }

    seen.add(key)
    references.push({
      specifier,
      referenceKind,
      isTypeOnly,
    })
  }

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      addReference(
        node.moduleSpecifier.text,
        'import',
        node.importClause?.isTypeOnly ?? false,
      )
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      addReference(
        node.moduleSpecifier.text,
        'export',
        node.isTypeOnly ?? false,
      )
    } else if (ts.isImportEqualsDeclaration(node)) {
      const moduleReference = node.moduleReference
      if (
        ts.isExternalModuleReference(moduleReference) &&
        moduleReference.expression !== undefined &&
        ts.isStringLiteralLike(moduleReference.expression)
      ) {
        addReference(moduleReference.expression.text, 'import-equals', false)
      }
    } else if (ts.isCallExpression(node)) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1
      ) {
        const [argument] = node.arguments
        if (argument !== undefined && ts.isStringLiteralLike(argument)) {
          addReference(argument.text, 'dynamic-import', false)
        }
      }

      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length === 1
      ) {
        const [argument] = node.arguments
        if (argument !== undefined && ts.isStringLiteralLike(argument)) {
          addReference(argument.text, 'require', false)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return references
}

function resolveDependency(
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
    kind,
    target,
  }
}

function getScriptKind(filePath: string): ts.ScriptKind {
  switch (path.extname(filePath).toLowerCase()) {
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS
    case '.jsx':
      return ts.ScriptKind.JSX
    case '.tsx':
      return ts.ScriptKind.TSX
    case '.json':
      return ts.ScriptKind.JSON
    default:
      return ts.ScriptKind.TS
  }
}

function resolveExistingPath(cwd: string, entryFile: string): string {
  const absolutePath = path.resolve(cwd, entryFile)
  const normalizedPath = normalizeFilePath(absolutePath)

  if (!fs.existsSync(normalizedPath)) {
    throw new Error(`Entry file not found: ${entryFile}`)
  }

  if (!isSourceCodeFile(normalizedPath)) {
    throw new Error(`Entry file must be a JS/TS source file: ${entryFile}`)
  }

  return normalizedPath
}
