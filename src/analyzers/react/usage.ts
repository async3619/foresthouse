import type { PendingReactUsageNode } from './file.js'
import {
  getComponentReferenceName,
  getCreateElementComponentReferenceName,
  getHookReferenceName,
  walkReactUsageTree,
} from './walk.js'

export function analyzeSymbolUsages(symbol: PendingReactUsageNode): void {
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
