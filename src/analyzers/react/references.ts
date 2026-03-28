import type { ReactSymbolKind } from '../../types/react-symbol-kind.js'
import type { ReactUsageEntry } from '../../types/react-usage-entry.js'
import type { ReactUsageNode } from '../../types/react-usage-node.js'
import type { ImportBinding } from './bindings.js'
import type { FileAnalysis } from './file.js'
import { isHookName } from './walk.js'

export function resolveReactReference(
  fileAnalysis: FileAnalysis,
  fileAnalyses: ReadonlyMap<string, FileAnalysis>,
  name: string,
  kind: ReactSymbolKind,
): string | undefined {
  if (kind === 'builtin') {
    return getBuiltinNodeId(name)
  }

  const dotIndex = name.indexOf('.')
  if (dotIndex !== -1) {
    return resolveNamespaceMemberReference(
      fileAnalysis,
      fileAnalyses,
      name.slice(0, dotIndex),
      name.slice(dotIndex + 1),
      kind,
    )
  }

  const localSymbol = fileAnalysis.allSymbolsByName.get(name)
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

  const targetId = resolveExportedSymbol(
    sourceFileAnalysis,
    importBinding.importedName,
    kind,
    fileAnalyses,
    new Set<string>(),
  )
  if (targetId === undefined) {
    return undefined
  }

  return targetId
}

function resolveNamespaceMemberReference(
  fileAnalysis: FileAnalysis,
  fileAnalyses: ReadonlyMap<string, FileAnalysis>,
  namespaceName: string,
  propertyName: string,
  kind: ReactSymbolKind,
): string | undefined {
  const importBinding = fileAnalysis.importsByLocalName.get(namespaceName)
  if (
    importBinding === undefined ||
    importBinding.importedName !== '*' ||
    importBinding.sourcePath === undefined
  ) {
    return undefined
  }

  const sourceFileAnalysis = fileAnalyses.get(importBinding.sourcePath)
  if (sourceFileAnalysis === undefined) {
    return undefined
  }

  return resolveExportedSymbol(
    sourceFileAnalysis,
    propertyName,
    kind,
    fileAnalyses,
    new Set<string>(),
  )
}

function resolveExportedSymbol(
  fileAnalysis: FileAnalysis,
  exportName: string,
  kind: ReactSymbolKind,
  fileAnalyses: ReadonlyMap<string, FileAnalysis>,
  visited: Set<string>,
): string | undefined {
  const visitKey = `${fileAnalysis.filePath}:${exportName}:${kind}`
  if (visited.has(visitKey)) {
    return undefined
  }

  visited.add(visitKey)

  const directTargetId = fileAnalysis.exportsByName.get(exportName)
  if (directTargetId !== undefined) {
    const directTargetSymbol = fileAnalysis.allSymbolsById.get(directTargetId)
    if (directTargetSymbol?.kind === kind) {
      return directTargetId
    }
  }

  const reExportBinding = fileAnalysis.reExportBindingsByName.get(exportName)
  if (reExportBinding?.sourcePath !== undefined) {
    const reExportSourceAnalysis = fileAnalyses.get(reExportBinding.sourcePath)
    if (reExportSourceAnalysis !== undefined) {
      const reExportTargetId = resolveExportedSymbol(
        reExportSourceAnalysis,
        reExportBinding.importedName,
        kind,
        fileAnalyses,
        visited,
      )
      if (reExportTargetId !== undefined) {
        return reExportTargetId
      }
    }
  }

  for (const exportAllBinding of fileAnalysis.exportAllBindings) {
    if (exportAllBinding.sourcePath === undefined) {
      continue
    }

    const exportAllSourceAnalysis = fileAnalyses.get(
      exportAllBinding.sourcePath,
    )
    if (exportAllSourceAnalysis === undefined) {
      continue
    }

    const exportAllTargetId = resolveExportedSymbol(
      exportAllSourceAnalysis,
      exportName,
      kind,
      fileAnalyses,
      visited,
    )
    if (exportAllTargetId !== undefined) {
      return exportAllTargetId
    }
  }

  return undefined
}

export function addExternalHookNodes(
  fileAnalyses: ReadonlyMap<string, FileAnalysis>,
  nodes: Map<string, ReactUsageNode>,
): void {
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
}

export function addBuiltinNodes(
  fileAnalyses: ReadonlyMap<string, FileAnalysis>,
  nodes: Map<string, ReactUsageNode>,
): void {
  for (const fileAnalysis of fileAnalyses.values()) {
    fileAnalysis.entryUsages.forEach((entry) => {
      if (entry.kind !== 'builtin') {
        return
      }

      const builtinNode = createBuiltinNode(entry.referenceName)
      if (!nodes.has(builtinNode.id)) {
        nodes.set(builtinNode.id, builtinNode)
      }
    })

    fileAnalysis.allSymbolsById.forEach((symbol) => {
      symbol.builtinReferences.forEach((name) => {
        const builtinNode = createBuiltinNode(name)
        if (!nodes.has(builtinNode.id)) {
          nodes.set(builtinNode.id, builtinNode)
        }
      })
    })
  }
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

function createBuiltinNode(name: string): ReactUsageNode {
  return {
    id: getBuiltinNodeId(name),
    name,
    kind: 'builtin',
    filePath: 'html',
    exportNames: [],
    usages: [],
  }
}

function getExternalHookNodeId(
  binding: ImportBinding,
  localName: string,
): string {
  return `external:${binding.sourceSpecifier}#hook:${getExternalHookName(binding, localName)}`
}

export function getBuiltinNodeId(name: string): string {
  return `builtin:${name}`
}

function getExternalHookName(
  binding: ImportBinding,
  localName: string,
): string {
  return binding.importedName === 'default' ? localName : binding.importedName
}

export function compareReactNodeIds(
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

export function compareReactUsageEntries(
  left: ReactUsageEntry,
  right: ReactUsageEntry,
  nodes: ReadonlyMap<string, ReactUsageNode>,
): number {
  return (
    left.location.filePath.localeCompare(right.location.filePath) ||
    left.location.line - right.location.line ||
    left.location.column - right.location.column ||
    left.referenceName.localeCompare(right.referenceName) ||
    compareReactNodeIds(left.target, right.target, nodes)
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
