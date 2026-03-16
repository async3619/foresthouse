import type { PendingReactUsageNode } from './file.js'
import {
  getBuiltinReferenceName,
  getComponentReferenceName,
  getCreateElementComponentReferenceName,
  getHookReferenceName,
  walkReactUsageTree,
} from './walk.js'

export function analyzeSymbolUsages(
  symbol: PendingReactUsageNode,
  includeBuiltins: boolean,
): void {
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

      if (includeBuiltins) {
        const builtinName = getBuiltinReferenceName(node)
        if (builtinName !== undefined) {
          symbol.builtinReferences.add(builtinName)
        }
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
