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
