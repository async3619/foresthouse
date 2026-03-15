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
  readonly unused: boolean
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
  const program = createProgram(resolvedEntryPath, compilerOptions, cwd)
  const checker = program.getTypeChecker()
  visitFile(resolvedEntryPath, compilerOptions, host, checker, program, nodes)

  return {
    cwd,
    entryId: resolvedEntryPath,
    nodes,
    ...(configPath === undefined ? {} : { configPath }),
  }
}

export function graphToSerializableTree(
  graph: DependencyGraph,
  options: {
    readonly omitUnused?: boolean
  } = {},
): object {
  const visited = new Set<string>()
  return serializeNode(
    graph.entryId,
    graph,
    visited,
    options.omitUnused ?? false,
  )
}

function serializeNode(
  filePath: string,
  graph: DependencyGraph,
  visited: Set<string>,
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

  visited.add(filePath)

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
        unused: dependency.unused,
        kind: dependency.kind,
        target: toDisplayPath(dependency.target, graph.cwd),
        node: serializeNode(
          dependency.target,
          graph,
          new Set(visited),
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

function visitFile(
  filePath: string,
  compilerOptions: ts.CompilerOptions,
  host: ts.ModuleResolutionHost,
  checker: ts.TypeChecker,
  program: ts.Program,
  nodes: Map<string, SourceModuleNode>,
): void {
  const normalizedPath = normalizeFilePath(filePath)
  if (nodes.has(normalizedPath)) {
    return
  }

  const sourceFile =
    program.getSourceFile(normalizedPath) ?? createSourceFile(normalizedPath)

  const references = collectModuleReferences(sourceFile, checker)
  const dependencies = references.map((reference) =>
    resolveDependency(reference, normalizedPath, compilerOptions, host),
  )

  nodes.set(normalizedPath, {
    id: normalizedPath,
    dependencies,
  })

  for (const dependency of dependencies) {
    if (dependency.kind === 'source') {
      visitFile(
        dependency.target,
        compilerOptions,
        host,
        checker,
        program,
        nodes,
      )
    }
  }
}

function collectModuleReferences(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ModuleReference[] {
  const references = new Map<string, ModuleReference>()
  const unusedImports = collectUnusedImports(sourceFile, checker)

  function addReference(
    specifier: string,
    referenceKind: ReferenceKind,
    isTypeOnly: boolean,
    unused: boolean,
  ): void {
    const key = `${referenceKind}:${isTypeOnly ? 'type' : 'value'}:${specifier}`
    const existing = references.get(key)
    if (existing !== undefined) {
      if (existing.unused && !unused) {
        references.set(key, {
          ...existing,
          unused: false,
        })
      }
      return
    }

    references.set(key, {
      specifier,
      referenceKind,
      isTypeOnly,
      unused,
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
        unusedImports.get(node) ?? false,
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
        false,
      )
    } else if (ts.isImportEqualsDeclaration(node)) {
      const moduleReference = node.moduleReference
      if (
        ts.isExternalModuleReference(moduleReference) &&
        moduleReference.expression !== undefined &&
        ts.isStringLiteralLike(moduleReference.expression)
      ) {
        addReference(
          moduleReference.expression.text,
          'import-equals',
          false,
          false,
        )
      }
    } else if (ts.isCallExpression(node)) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1
      ) {
        const [argument] = node.arguments
        if (argument !== undefined && ts.isStringLiteralLike(argument)) {
          addReference(argument.text, 'dynamic-import', false, false)
        }
      }

      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length === 1
      ) {
        const [argument] = node.arguments
        if (argument !== undefined && ts.isStringLiteralLike(argument)) {
          addReference(argument.text, 'require', false, false)
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return [...references.values()]
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
    unused: reference.unused,
    kind,
    target,
  }
}

function createProgram(
  entryFile: string,
  compilerOptions: ts.CompilerOptions,
  cwd: string,
): ts.Program {
  const host = ts.createCompilerHost(compilerOptions, true)
  host.getCurrentDirectory = () => cwd

  if (ts.sys.realpath !== undefined) {
    host.realpath = ts.sys.realpath
  }

  return ts.createProgram({
    rootNames: [entryFile],
    options: compilerOptions,
    host,
  })
}

function createSourceFile(filePath: string): ts.SourceFile {
  const sourceText = fs.readFileSync(filePath, 'utf8')
  return ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  )
}

function collectUnusedImports(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
): ReadonlyMap<ts.ImportDeclaration, boolean> {
  const importUsage = new Map<
    ts.ImportDeclaration,
    {
      canTrack: boolean
      used: boolean
    }
  >()
  const symbolToImportDeclaration = new Map<ts.Symbol, ts.ImportDeclaration>()
  const importedLocalNames = new Set<string>()

  sourceFile.statements.forEach((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      statement.importClause === undefined
    ) {
      return
    }

    const identifiers = getImportBindingIdentifiers(statement.importClause)
    if (identifiers.length === 0) {
      return
    }

    importUsage.set(statement, {
      canTrack: false,
      used: false,
    })

    identifiers.forEach((identifier) => {
      importedLocalNames.add(identifier.text)

      const symbol = tryGetSymbolAtLocation(checker, identifier)
      if (symbol === undefined) {
        return
      }

      symbolToImportDeclaration.set(symbol, statement)
      const state = importUsage.get(statement)
      if (state !== undefined) {
        state.canTrack = true
      }
    })
  })

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      return
    }

    if (
      ts.isIdentifier(node) &&
      importedLocalNames.has(node.text) &&
      isReferenceIdentifier(node)
    ) {
      const symbol = tryGetSymbolAtLocation(checker, node)
      const declaration =
        symbol === undefined ? undefined : symbolToImportDeclaration.get(symbol)
      if (declaration !== undefined) {
        const state = importUsage.get(declaration)
        if (state !== undefined) {
          state.used = true
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return new Map(
    [...importUsage.entries()].map(([declaration, state]) => [
      declaration,
      state.canTrack && !state.used,
    ]),
  )
}

function getImportBindingIdentifiers(
  importClause: ts.ImportClause,
): ts.Identifier[] {
  const identifiers: ts.Identifier[] = []

  if (importClause.name !== undefined) {
    identifiers.push(importClause.name)
  }

  const namedBindings = importClause.namedBindings
  if (namedBindings === undefined) {
    return identifiers
  }

  if (ts.isNamespaceImport(namedBindings)) {
    identifiers.push(namedBindings.name)
    return identifiers
  }

  namedBindings.elements.forEach((element) => {
    identifiers.push(element.name)
  })

  return identifiers
}

function isReferenceIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent

  if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
    return false
  }

  if (ts.isQualifiedName(parent) && parent.right === node) {
    return false
  }

  if (ts.isPropertyAssignment(parent) && parent.name === node) {
    return false
  }

  if (ts.isBindingElement(parent) && parent.propertyName === node) {
    return false
  }

  if (ts.isJsxAttribute(parent) && parent.name === node) {
    return false
  }

  if (ts.isExportSpecifier(parent)) {
    return parent.propertyName === node || parent.propertyName === undefined
  }

  return true
}

function tryGetSymbolAtLocation(
  checker: ts.TypeChecker,
  node: ts.Node,
): ts.Symbol | undefined {
  try {
    return checker.getSymbolAtLocation(node)
  } catch {
    return undefined
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
