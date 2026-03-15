import fs from 'node:fs'
import type {
  ArrowFunctionExpression,
  CallExpression,
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  Expression,
  FunctionBody,
  ImportDeclaration,
  ImportDeclarationSpecifier,
  JSXElement,
  JSXElementName,
  JSXFragment,
  ModuleExportName,
  Node,
  Function as OxcFunction,
  Program,
  Statement,
  VariableDeclarator,
} from 'oxc-parser'
import { parseSync, visitorKeys } from 'oxc-parser'

import { analyzeDependencies } from './analyzer.js'
import { isSourceCodeFile, toDisplayPath } from './path-utils.js'
import type {
  AnalyzeOptions,
  ReactSymbolKind,
  ReactUsageEdge,
  ReactUsageEntry,
  ReactUsageFilter,
  ReactUsageGraph,
  ReactUsageLocation,
  ReactUsageNode,
} from './types.js'

interface PendingReactUsageNode {
  readonly id: string
  readonly name: string
  readonly kind: ReactSymbolKind
  readonly filePath: string
  readonly declaration: OxcFunction | ArrowFunctionExpression
  readonly exportNames: Set<string>
  readonly componentReferences: Set<string>
  readonly hookReferences: Set<string>
}

interface PendingReactUsageEntry {
  readonly referenceName: string
  readonly location: ReactUsageLocation
}

interface ImportBinding {
  readonly importedName: string
  readonly sourceSpecifier: string
  readonly sourcePath?: string
}

interface FileAnalysis {
  readonly filePath: string
  readonly importsByLocalName: Map<string, ImportBinding>
  readonly exportsByName: Map<string, string>
  readonly renderEntries: readonly PendingReactUsageEntry[]
  readonly symbolsById: Map<string, PendingReactUsageNode>
  readonly symbolsByName: Map<string, PendingReactUsageNode>
}

interface SerializedReactUsageNode {
  readonly id: string
  readonly name: string
  readonly symbolKind: ReactSymbolKind | 'circular'
  readonly filePath: string
  readonly exportNames: readonly string[]
  readonly usages: readonly SerializedReactUsageEdge[]
}

interface SerializedReactUsageEntry {
  readonly targetId: string
  readonly filePath: string
  readonly line: number
  readonly column: number
  readonly node: SerializedReactUsageNode
}

interface SerializedReactUsageEdge {
  readonly kind: ReactUsageEdge['kind']
  readonly targetId: string
  readonly node: SerializedReactUsageNode
}

const FUNCTION_NODE_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
])

export function analyzeReactUsage(
  entryFile: string,
  options: AnalyzeOptions = {},
): ReactUsageGraph {
  const dependencyGraph = analyzeDependencies(entryFile, options)
  const reachableFiles = new Set<string>([
    dependencyGraph.entryId,
    ...dependencyGraph.nodes.keys(),
  ])
  const fileAnalyses = new Map<string, FileAnalysis>()

  for (const filePath of [...reachableFiles].sort()) {
    if (!isSourceCodeFile(filePath) || filePath.endsWith('.d.ts')) {
      continue
    }

    const sourceText = fs.readFileSync(filePath, 'utf8')
    const parseResult = parseSync(filePath, sourceText, {
      astType: 'ts',
      sourceType: 'unambiguous',
    })

    const dependencyNode = dependencyGraph.nodes.get(filePath)
    const sourceDependencies = new Map<string, string>()
    dependencyNode?.dependencies.forEach((dependency) => {
      if (dependency.kind === 'source') {
        sourceDependencies.set(dependency.specifier, dependency.target)
      }
    })

    fileAnalyses.set(
      filePath,
      analyzeReactFile(
        parseResult.program,
        filePath,
        sourceText,
        filePath === dependencyGraph.entryId,
        sourceDependencies,
      ),
    )
  }

  const nodes = new Map<string, ReactUsageNode>()
  for (const fileAnalysis of fileAnalyses.values()) {
    for (const symbol of fileAnalysis.symbolsById.values()) {
      nodes.set(symbol.id, {
        id: symbol.id,
        name: symbol.name,
        kind: symbol.kind,
        filePath: symbol.filePath,
        exportNames: [...symbol.exportNames].sort(),
        usages: [],
      })
    }
  }

  for (const fileAnalysis of fileAnalyses.values()) {
    fileAnalysis.importsByLocalName.forEach((binding, localName) => {
      if (binding.sourcePath !== undefined) {
        return
      }

      if (!isHookName(localName) && !isHookName(binding.importedName)) {
        return
      }

      const externalNode = createExternalHookNode(binding, localName)
      if (!nodes.has(externalNode.id)) {
        nodes.set(externalNode.id, externalNode)
      }
    })
  }

  for (const fileAnalysis of fileAnalyses.values()) {
    for (const symbol of fileAnalysis.symbolsById.values()) {
      const usages = new Map<string, ReactUsageEdge>()

      symbol.componentReferences.forEach((referenceName) => {
        const targetId = resolveReactReference(
          fileAnalysis,
          fileAnalyses,
          referenceName,
          'component',
        )
        if (targetId !== undefined && targetId !== symbol.id) {
          usages.set(`render:${targetId}`, {
            kind: 'render',
            target: targetId,
          })
        }
      })

      symbol.hookReferences.forEach((referenceName) => {
        const targetId = resolveReactReference(
          fileAnalysis,
          fileAnalyses,
          referenceName,
          'hook',
        )
        if (targetId !== undefined && targetId !== symbol.id) {
          usages.set(`hook:${targetId}`, {
            kind: 'hook-call',
            target: targetId,
          })
        }
      })

      const node = nodes.get(symbol.id)
      if (node === undefined) {
        continue
      }

      const sortedUsages = [...usages.values()].sort((left, right) =>
        compareReactNodeIds(left.target, right.target, nodes),
      )

      nodes.set(symbol.id, {
        ...node,
        usages: sortedUsages,
      })
    }
  }

  const entriesByKey = new Map<string, ReactUsageEntry>()
  for (const fileAnalysis of fileAnalyses.values()) {
    for (const entry of fileAnalysis.renderEntries) {
      const targetId = resolveReactReference(
        fileAnalysis,
        fileAnalyses,
        entry.referenceName,
        'component',
      )
      if (targetId === undefined) {
        continue
      }

      const key = `${entry.location.filePath}:${entry.location.line}:${entry.location.column}:${targetId}`
      entriesByKey.set(key, {
        target: targetId,
        location: entry.location,
      })
    }
  }

  const entries = [...entriesByKey.values()].sort((left, right) =>
    compareReactUsageEntries(left, right, nodes),
  )

  return {
    cwd: dependencyGraph.cwd,
    entryId: dependencyGraph.entryId,
    nodes,
    entries,
  }
}

export function graphToSerializableReactTree(
  graph: ReactUsageGraph,
  options: {
    readonly filter?: ReactUsageFilter
  } = {},
): object {
  const filter = options.filter ?? 'all'
  const entries = getReactUsageEntries(graph, filter)
  const roots =
    entries.length > 0
      ? entries.map((entry) =>
          serializeReactUsageNode(entry.target, graph, filter, new Set()),
        )
      : getReactUsageRoots(graph, filter).map((rootId) =>
          serializeReactUsageNode(rootId, graph, filter, new Set()),
        )

  return {
    kind: 'react-usage',
    entries: entries.map((entry) =>
      serializeReactUsageEntry(entry, graph, filter),
    ),
    roots,
  }
}

export function getReactUsageEntries(
  graph: ReactUsageGraph,
  filter: ReactUsageFilter = 'all',
): ReactUsageEntry[] {
  if (filter === 'hook') {
    return []
  }

  return graph.entries.filter((entry) => {
    const targetNode = graph.nodes.get(entry.target)
    return targetNode !== undefined && matchesReactFilter(targetNode, filter)
  })
}

export function getReactUsageRoots(
  graph: ReactUsageGraph,
  filter: ReactUsageFilter = 'all',
): string[] {
  const entries = getReactUsageEntries(graph, filter)
  if (entries.length > 0) {
    return [...new Set(entries.map((entry) => entry.target))]
  }

  const filteredNodes = getFilteredReactUsageNodes(graph, filter)
  const inboundCounts = new Map<string, number>()

  filteredNodes.forEach((node) => {
    inboundCounts.set(node.id, 0)
  })

  filteredNodes.forEach((node) => {
    getFilteredUsages(node, graph, filter).forEach((usage) => {
      inboundCounts.set(
        usage.target,
        (inboundCounts.get(usage.target) ?? 0) + 1,
      )
    })
  })

  const roots = filteredNodes
    .filter((node) => (inboundCounts.get(node.id) ?? 0) === 0)
    .map((node) => node.id)

  if (roots.length > 0) {
    return roots.sort((left, right) =>
      compareReactNodeIds(left, right, graph.nodes),
    )
  }

  return filteredNodes
    .map((node) => node.id)
    .sort((left, right) => compareReactNodeIds(left, right, graph.nodes))
}

export function getFilteredUsages(
  node: ReactUsageNode,
  graph: ReactUsageGraph,
  filter: ReactUsageFilter = 'all',
): ReactUsageEdge[] {
  return node.usages.filter((usage) => {
    const targetNode = graph.nodes.get(usage.target)
    return targetNode !== undefined && matchesReactFilter(targetNode, filter)
  })
}

function analyzeReactFile(
  program: Program,
  filePath: string,
  sourceText: string,
  includeNestedRenderEntries: boolean,
  sourceDependencies: ReadonlyMap<string, string>,
): FileAnalysis {
  const symbolsByName = new Map<string, PendingReactUsageNode>()

  program.body.forEach((statement) => {
    collectTopLevelReactSymbols(statement, filePath, symbolsByName)
  })

  const importsByLocalName = new Map<string, ImportBinding>()
  const exportsByName = new Map<string, string>()
  const renderEntries = collectRenderEntries(
    program,
    filePath,
    sourceText,
    includeNestedRenderEntries,
  )

  program.body.forEach((statement) => {
    collectImportsAndExports(
      statement,
      sourceDependencies,
      symbolsByName,
      importsByLocalName,
      exportsByName,
    )
  })

  symbolsByName.forEach((symbol) => {
    analyzeSymbolUsages(symbol)
  })

  return {
    filePath,
    importsByLocalName,
    exportsByName,
    renderEntries,
    symbolsById: new Map(
      [...symbolsByName.values()].map((symbol) => [symbol.id, symbol]),
    ),
    symbolsByName,
  }
}

function collectRenderEntries(
  program: Program,
  filePath: string,
  sourceText: string,
  includeNestedFunctions: boolean,
): PendingReactUsageEntry[] {
  const entries = new Map<string, PendingReactUsageEntry>()

  program.body.forEach((statement) => {
    collectStatementRenderEntries(
      statement,
      filePath,
      sourceText,
      entries,
      includeNestedFunctions,
    )
  })

  return [...entries.values()].sort(comparePendingReactUsageEntries)
}

function collectStatementRenderEntries(
  statement: Statement,
  filePath: string,
  sourceText: string,
  entries: Map<string, PendingReactUsageEntry>,
  includeNestedFunctions: boolean,
): void {
  collectNodeRenderEntries(
    statement,
    filePath,
    sourceText,
    entries,
    false,
    includeNestedFunctions,
  )
}

function collectNodeRenderEntries(
  node: Node,
  filePath: string,
  sourceText: string,
  entries: Map<string, PendingReactUsageEntry>,
  hasComponentAncestor: boolean,
  includeNestedFunctions: boolean,
): void {
  if (!includeNestedFunctions && FUNCTION_NODE_TYPES.has(node.type)) {
    return
  }

  let nextHasComponentAncestor = hasComponentAncestor

  if (node.type === 'JSXElement') {
    const referenceName = getComponentReferenceName(node)
    if (referenceName !== undefined) {
      if (!hasComponentAncestor) {
        addPendingRenderEntry(
          entries,
          referenceName,
          createReactUsageLocation(filePath, sourceText, node.start),
        )
      }
      nextHasComponentAncestor = true
    }
  } else if (node.type === 'CallExpression') {
    const referenceName = getCreateElementComponentReferenceName(node)
    if (referenceName !== undefined) {
      if (!hasComponentAncestor) {
        addPendingRenderEntry(
          entries,
          referenceName,
          createReactUsageLocation(filePath, sourceText, node.start),
        )
      }
      nextHasComponentAncestor = true
    }
  }

  const keys = visitorKeys[node.type]
  if (keys === undefined) {
    return
  }

  keys.forEach((key) => {
    const value = (node as unknown as Record<string, unknown>)[key]
    collectRenderEntryChild(
      value,
      filePath,
      sourceText,
      entries,
      nextHasComponentAncestor,
      includeNestedFunctions,
    )
  })
}

function collectRenderEntryChild(
  value: unknown,
  filePath: string,
  sourceText: string,
  entries: Map<string, PendingReactUsageEntry>,
  hasComponentAncestor: boolean,
  includeNestedFunctions: boolean,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      collectRenderEntryChild(
        entry,
        filePath,
        sourceText,
        entries,
        hasComponentAncestor,
        includeNestedFunctions,
      )
    })
    return
  }

  if (!isNode(value)) {
    return
  }

  collectNodeRenderEntries(
    value,
    filePath,
    sourceText,
    entries,
    hasComponentAncestor,
    includeNestedFunctions,
  )
}

function addPendingRenderEntry(
  entries: Map<string, PendingReactUsageEntry>,
  referenceName: string,
  location: ReactUsageLocation,
): void {
  const key = `${location.filePath}:${location.line}:${location.column}:${referenceName}`
  entries.set(key, {
    referenceName,
    location,
  })
}

function createReactUsageLocation(
  filePath: string,
  sourceText: string,
  offset: number,
): ReactUsageLocation {
  return {
    filePath,
    ...offsetToLineAndColumn(sourceText, offset),
  }
}

function offsetToLineAndColumn(
  sourceText: string,
  offset: number,
): Pick<ReactUsageLocation, 'line' | 'column'> {
  let line = 1
  let column = 1

  for (let index = 0; index < offset && index < sourceText.length; index += 1) {
    if (sourceText[index] === '\n') {
      line += 1
      column = 1
      continue
    }

    column += 1
  }

  return { line, column }
}

function collectTopLevelReactSymbols(
  statement: Statement,
  filePath: string,
  symbolsByName: Map<string, PendingReactUsageNode>,
): void {
  switch (statement.type) {
    case 'FunctionDeclaration':
      addFunctionSymbol(statement, filePath, symbolsByName)
      return
    case 'VariableDeclaration':
      statement.declarations.forEach((declarator) => {
        addVariableSymbol(declarator, filePath, symbolsByName)
      })
      return
    case 'ExportNamedDeclaration':
      if (statement.declaration !== null) {
        collectTopLevelReactSymbols(
          statement.declaration,
          filePath,
          symbolsByName,
        )
      }
      return
    case 'ExportDefaultDeclaration':
      addDefaultExportSymbol(statement, filePath, symbolsByName)
      return
    default:
      return
  }
}

function addFunctionSymbol(
  declaration: OxcFunction,
  filePath: string,
  symbolsByName: Map<string, PendingReactUsageNode>,
): void {
  const name = declaration.id?.name
  if (name === undefined) {
    return
  }

  const kind = classifyReactSymbol(name, declaration)
  if (kind === undefined) {
    return
  }

  symbolsByName.set(
    name,
    createPendingSymbol(filePath, name, kind, declaration),
  )
}

function addVariableSymbol(
  declarator: VariableDeclarator,
  filePath: string,
  symbolsByName: Map<string, PendingReactUsageNode>,
): void {
  if (declarator.id.type !== 'Identifier' || declarator.init === null) {
    return
  }

  if (
    declarator.init.type !== 'ArrowFunctionExpression' &&
    declarator.init.type !== 'FunctionExpression'
  ) {
    return
  }

  const name = declarator.id.name
  const kind = classifyReactSymbol(name, declarator.init)
  if (kind === undefined) {
    return
  }

  symbolsByName.set(
    name,
    createPendingSymbol(filePath, name, kind, declarator.init),
  )
}

function addDefaultExportSymbol(
  declaration: ExportDefaultDeclaration,
  filePath: string,
  symbolsByName: Map<string, PendingReactUsageNode>,
): void {
  if (
    declaration.declaration.type === 'FunctionDeclaration' ||
    declaration.declaration.type === 'FunctionExpression'
  ) {
    addFunctionSymbol(declaration.declaration, filePath, symbolsByName)
  } else if (declaration.declaration.type === 'ArrowFunctionExpression') {
    const name = 'default'
    const kind = declaration.declaration.body
      ? classifyReactSymbol(name, declaration.declaration)
      : undefined
    if (kind !== undefined) {
      symbolsByName.set(
        name,
        createPendingSymbol(filePath, name, kind, declaration.declaration),
      )
    }
  }
}

function createPendingSymbol(
  filePath: string,
  name: string,
  kind: ReactSymbolKind,
  declaration: OxcFunction | ArrowFunctionExpression,
): PendingReactUsageNode {
  return {
    id: `${filePath}#${kind}:${name}`,
    name,
    kind,
    filePath,
    declaration,
    exportNames: new Set<string>(),
    componentReferences: new Set<string>(),
    hookReferences: new Set<string>(),
  }
}

function collectImportsAndExports(
  statement: Statement,
  sourceDependencies: ReadonlyMap<string, string>,
  symbolsByName: ReadonlyMap<string, PendingReactUsageNode>,
  importsByLocalName: Map<string, ImportBinding>,
  exportsByName: Map<string, string>,
): void {
  switch (statement.type) {
    case 'ImportDeclaration':
      collectImportBindings(statement, sourceDependencies, importsByLocalName)
      return
    case 'ExportNamedDeclaration':
      collectNamedExports(statement, symbolsByName, exportsByName)
      return
    case 'ExportDefaultDeclaration':
      collectDefaultExport(statement, symbolsByName, exportsByName)
      return
    default:
      return
  }
}

function collectImportBindings(
  declaration: ImportDeclaration,
  sourceDependencies: ReadonlyMap<string, string>,
  importsByLocalName: Map<string, ImportBinding>,
): void {
  if (declaration.importKind === 'type') {
    return
  }

  const sourceSpecifier = declaration.source.value
  const sourcePath = sourceDependencies.get(declaration.source.value)

  declaration.specifiers.forEach((specifier) => {
    const binding = getImportBinding(specifier, sourceSpecifier, sourcePath)
    if (binding === undefined) {
      return
    }

    importsByLocalName.set(binding.localName, {
      importedName: binding.importedName,
      sourceSpecifier: binding.sourceSpecifier,
      ...(binding.sourcePath === undefined
        ? {}
        : { sourcePath: binding.sourcePath }),
    })
  })
}

function getImportBinding(
  specifier: ImportDeclarationSpecifier,
  sourceSpecifier: string,
  sourcePath: string | undefined,
):
  | {
      readonly localName: string
      readonly importedName: string
      readonly sourceSpecifier: string
      readonly sourcePath?: string
    }
  | undefined {
  if (specifier.type === 'ImportSpecifier') {
    if (specifier.importKind === 'type') {
      return undefined
    }

    return {
      localName: specifier.local.name,
      importedName: toModuleExportName(specifier.imported),
      sourceSpecifier,
      ...(sourcePath === undefined ? {} : { sourcePath }),
    }
  }

  if (specifier.type === 'ImportDefaultSpecifier') {
    return {
      localName: specifier.local.name,
      importedName: 'default',
      sourceSpecifier,
      ...(sourcePath === undefined ? {} : { sourcePath }),
    }
  }

  return undefined
}

function collectNamedExports(
  declaration: ExportNamedDeclaration,
  symbolsByName: ReadonlyMap<string, PendingReactUsageNode>,
  exportsByName: Map<string, string>,
): void {
  if (declaration.exportKind === 'type') {
    return
  }

  if (declaration.declaration !== null) {
    if (declaration.declaration.type === 'FunctionDeclaration') {
      const name = declaration.declaration.id?.name
      if (name !== undefined) {
        addExportBinding(name, name, symbolsByName, exportsByName)
      }
    } else if (declaration.declaration.type === 'VariableDeclaration') {
      declaration.declaration.declarations.forEach((declarator) => {
        if (declarator.id.type === 'Identifier') {
          addExportBinding(
            declarator.id.name,
            declarator.id.name,
            symbolsByName,
            exportsByName,
          )
        }
      })
    }

    return
  }

  if (declaration.source !== null) {
    return
  }

  declaration.specifiers.forEach((specifier) => {
    if (specifier.exportKind === 'type') {
      return
    }

    const localName = toModuleExportName(specifier.local)
    const exportedName = toModuleExportName(specifier.exported)
    addExportBinding(localName, exportedName, symbolsByName, exportsByName)
  })
}

function collectDefaultExport(
  declaration: ExportDefaultDeclaration,
  symbolsByName: ReadonlyMap<string, PendingReactUsageNode>,
  exportsByName: Map<string, string>,
): void {
  if (
    declaration.declaration.type === 'FunctionDeclaration' ||
    declaration.declaration.type === 'FunctionExpression'
  ) {
    const localName = declaration.declaration.id?.name
    if (localName !== undefined) {
      addExportBinding(localName, 'default', symbolsByName, exportsByName)
    }
    return
  }

  if (declaration.declaration.type === 'Identifier') {
    addExportBinding(
      declaration.declaration.name,
      'default',
      symbolsByName,
      exportsByName,
    )
    return
  }

  if (declaration.declaration.type === 'ArrowFunctionExpression') {
    addExportBinding('default', 'default', symbolsByName, exportsByName)
  }
}

function addExportBinding(
  localName: string,
  exportedName: string,
  symbolsByName: ReadonlyMap<string, PendingReactUsageNode>,
  exportsByName: Map<string, string>,
): void {
  const symbol = symbolsByName.get(localName)
  if (symbol === undefined) {
    return
  }

  symbol.exportNames.add(exportedName)
  exportsByName.set(exportedName, symbol.id)
}

function analyzeSymbolUsages(symbol: PendingReactUsageNode): void {
  const root =
    symbol.declaration.type === 'ArrowFunctionExpression'
      ? symbol.declaration.body
      : symbol.declaration.body

  if (root === null) {
    return
  }

  walkReactUsageTree(root, (node) => {
    if (node.type === 'JSXElement') {
      const name = getComponentReferenceName(node)
      if (name !== undefined) {
        symbol.componentReferences.add(name)
      }
      return
    }

    if (node.type === 'CallExpression') {
      const hookReference = getHookReferenceName(node)
      if (hookReference !== undefined) {
        symbol.hookReferences.add(hookReference)
      }

      const componentReference = getCreateElementComponentReferenceName(node)
      if (componentReference !== undefined) {
        symbol.componentReferences.add(componentReference)
      }
    }
  })
}

function classifyReactSymbol(
  name: string,
  declaration: OxcFunction | ArrowFunctionExpression,
): ReactSymbolKind | undefined {
  if (isHookName(name)) {
    return 'hook'
  }

  if (isComponentName(name) && returnsReactElement(declaration)) {
    return 'component'
  }

  return undefined
}

function returnsReactElement(
  declaration: OxcFunction | ArrowFunctionExpression,
): boolean {
  if (
    declaration.type === 'ArrowFunctionExpression' &&
    declaration.expression
  ) {
    return containsReactElementLikeExpression(declaration.body as Expression)
  }

  const body = declaration.body
  if (body === null) {
    return false
  }

  let found = false
  walkReactUsageTree(body, (node) => {
    if (node.type !== 'ReturnStatement' || node.argument === null) {
      return
    }

    if (containsReactElementLikeExpression(node.argument)) {
      found = true
    }
  })

  return found
}

function containsReactElementLikeExpression(expression: Expression): boolean {
  let found = false

  walkNode(expression, (node) => {
    if (
      node.type === 'JSXElement' ||
      node.type === 'JSXFragment' ||
      (node.type === 'CallExpression' && isReactCreateElementCall(node))
    ) {
      found = true
    }
  })

  return found
}

function getComponentReferenceName(node: JSXElement): string | undefined {
  const name = getJsxName(node.openingElement.name)
  return name !== undefined && isComponentName(name) ? name : undefined
}

function getHookReferenceName(node: CallExpression): string | undefined {
  const calleeName = getIdentifierName(node.callee)
  return calleeName !== undefined && isHookName(calleeName)
    ? calleeName
    : undefined
}

function getCreateElementComponentReferenceName(
  node: CallExpression,
): string | undefined {
  if (!isReactCreateElementCall(node)) {
    return undefined
  }

  const [firstArgument] = node.arguments
  if (firstArgument === undefined || firstArgument.type !== 'Identifier') {
    return undefined
  }

  return isComponentName(firstArgument.name) ? firstArgument.name : undefined
}

function isReactCreateElementCall(node: CallExpression): boolean {
  const callee = unwrapExpression(node.callee)
  if (callee.type !== 'MemberExpression' || callee.computed) {
    return false
  }

  return (
    callee.object.type === 'Identifier' &&
    callee.object.name === 'React' &&
    callee.property.name === 'createElement'
  )
}

function getJsxName(name: JSXElementName): string | undefined {
  if (name.type === 'JSXIdentifier') {
    return name.name
  }

  return undefined
}

function getIdentifierName(expression: Expression): string | undefined {
  const unwrapped = unwrapExpression(expression)
  return unwrapped.type === 'Identifier' ? unwrapped.name : undefined
}

function unwrapExpression(expression: Expression): Expression {
  let current = expression

  while (true) {
    if (
      current.type === 'ParenthesizedExpression' ||
      current.type === 'TSAsExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'TSTypeAssertion' ||
      current.type === 'TSNonNullExpression'
    ) {
      current = current.expression
      continue
    }

    return current
  }
}

function walkReactUsageTree(
  root: FunctionBody | Expression | JSXFragment | JSXElement,
  visit: (node: Node) => void,
): void {
  walkNode(root, visit, true)
}

function walkNode(
  node: Node,
  visit: (node: Node) => void,
  allowNestedFunctions = false,
): void {
  visit(node)

  const keys = visitorKeys[node.type]
  if (keys === undefined) {
    return
  }

  keys.forEach((key) => {
    const value = (node as unknown as Record<string, unknown>)[key]
    walkChild(value, visit, allowNestedFunctions)
  })
}

function walkChild(
  value: unknown,
  visit: (node: Node) => void,
  allowNestedFunctions: boolean,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      walkChild(entry, visit, allowNestedFunctions)
    })
    return
  }

  if (!isNode(value)) {
    return
  }

  if (!allowNestedFunctions && FUNCTION_NODE_TYPES.has(value.type)) {
    return
  }

  walkNode(value, visit, false)
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  )
}

function resolveReactReference(
  fileAnalysis: FileAnalysis,
  fileAnalyses: ReadonlyMap<string, FileAnalysis>,
  name: string,
  kind: ReactSymbolKind,
): string | undefined {
  const localSymbol = fileAnalysis.symbolsByName.get(name)
  if (localSymbol !== undefined && localSymbol.kind === kind) {
    return localSymbol.id
  }

  const importBinding = fileAnalysis.importsByLocalName.get(name)
  if (importBinding === undefined) {
    return undefined
  }

  if (importBinding.sourcePath === undefined) {
    return kind === 'hook'
      ? getExternalHookNodeId(importBinding, name)
      : undefined
  }

  const sourceFileAnalysis = fileAnalyses.get(importBinding.sourcePath)
  if (sourceFileAnalysis === undefined) {
    return undefined
  }

  const targetId = sourceFileAnalysis.exportsByName.get(
    importBinding.importedName,
  )
  if (targetId === undefined) {
    return undefined
  }

  const targetSymbol = sourceFileAnalysis.symbolsById.get(targetId)
  return targetSymbol?.kind === kind ? targetId : undefined
}

function createExternalHookNode(
  binding: ImportBinding,
  localName: string,
): ReactUsageNode {
  const name = getExternalHookName(binding, localName)

  return {
    id: getExternalHookNodeId(binding, localName),
    name,
    kind: 'hook',
    filePath: binding.sourceSpecifier,
    exportNames: [binding.importedName],
    usages: [],
  }
}

function getExternalHookNodeId(
  binding: ImportBinding,
  localName: string,
): string {
  return `external:${binding.sourceSpecifier}#hook:${getExternalHookName(binding, localName)}`
}

function getExternalHookName(
  binding: ImportBinding,
  localName: string,
): string {
  return binding.importedName === 'default' ? localName : binding.importedName
}

function getFilteredReactUsageNodes(
  graph: ReactUsageGraph,
  filter: ReactUsageFilter,
): ReactUsageNode[] {
  return [...graph.nodes.values()]
    .filter((node) => matchesReactFilter(node, filter))
    .sort((left, right) => compareReactNodes(left, right))
}

function matchesReactFilter(
  node: ReactUsageNode,
  filter: ReactUsageFilter,
): boolean {
  return filter === 'all' || node.kind === filter
}

function serializeReactUsageNode(
  nodeId: string,
  graph: ReactUsageGraph,
  filter: ReactUsageFilter,
  visited: Set<string>,
): SerializedReactUsageNode {
  const node = graph.nodes.get(nodeId)
  if (node === undefined) {
    return {
      id: nodeId,
      name: nodeId,
      symbolKind: 'circular',
      filePath: '',
      exportNames: [],
      usages: [],
    }
  }

  if (visited.has(nodeId)) {
    return {
      id: node.id,
      name: node.name,
      symbolKind: 'circular',
      filePath: toDisplayPath(node.filePath, graph.cwd),
      exportNames: node.exportNames,
      usages: [],
    }
  }

  const nextVisited = new Set(visited)
  nextVisited.add(nodeId)

  return {
    id: node.id,
    name: node.name,
    symbolKind: node.kind,
    filePath: toDisplayPath(node.filePath, graph.cwd),
    exportNames: node.exportNames,
    usages: getFilteredUsages(node, graph, filter).map((usage) => ({
      kind: usage.kind,
      targetId: usage.target,
      node: serializeReactUsageNode(usage.target, graph, filter, nextVisited),
    })),
  }
}

function serializeReactUsageEntry(
  entry: ReactUsageEntry,
  graph: ReactUsageGraph,
  filter: ReactUsageFilter,
): SerializedReactUsageEntry {
  return {
    targetId: entry.target,
    filePath: toDisplayPath(entry.location.filePath, graph.cwd),
    line: entry.location.line,
    column: entry.location.column,
    node: serializeReactUsageNode(entry.target, graph, filter, new Set()),
  }
}

function compareReactNodeIds(
  leftId: string,
  rightId: string,
  nodes: ReadonlyMap<string, ReactUsageNode>,
): number {
  const left = nodes.get(leftId)
  const right = nodes.get(rightId)

  if (left === undefined || right === undefined) {
    return leftId.localeCompare(rightId)
  }

  return compareReactNodes(left, right)
}

function compareReactUsageEntries(
  left: ReactUsageEntry,
  right: ReactUsageEntry,
  nodes: ReadonlyMap<string, ReactUsageNode>,
): number {
  return (
    left.location.filePath.localeCompare(right.location.filePath) ||
    left.location.line - right.location.line ||
    left.location.column - right.location.column ||
    compareReactNodeIds(left.target, right.target, nodes)
  )
}

function comparePendingReactUsageEntries(
  left: PendingReactUsageEntry,
  right: PendingReactUsageEntry,
): number {
  return (
    left.location.filePath.localeCompare(right.location.filePath) ||
    left.location.line - right.location.line ||
    left.location.column - right.location.column ||
    left.referenceName.localeCompare(right.referenceName)
  )
}

function compareReactNodes(
  left: ReactUsageNode,
  right: ReactUsageNode,
): number {
  return (
    left.filePath.localeCompare(right.filePath) ||
    left.name.localeCompare(right.name) ||
    left.kind.localeCompare(right.kind)
  )
}

function toModuleExportName(name: ModuleExportName): string {
  return name.type === 'Literal' ? name.value : name.name
}

function isHookName(name: string): boolean {
  return /^use[A-Z0-9]/.test(name)
}

function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name)
}
