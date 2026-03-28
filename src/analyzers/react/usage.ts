import type { PendingReactUsageNode } from './file.js'
import {
  getBuiltinReferenceName,
  getComponentReferenceName,
  getCreateElementComponentReferenceName,
  getHookReferenceName,
  getMemberExpressionComponentReferenceName,
  getStyledBuiltinReferenceName,
  getStyledComponentReferenceName,
  walkReactUsageTree,
} from './walk.js'

export function analyzeSymbolUsages(
  symbol: PendingReactUsageNode,
  includeBuiltins: boolean,
): void {
  walkReactUsageTree(symbol.analysisRoot, (node) => {
    if (node.type === 'JSXElement') {
      const name = getComponentReferenceName(node)
      if (name !== undefined) {
        symbol.componentReferences.add(name)
      } else {
        const memberName = getMemberExpressionComponentReferenceName(node)
        if (memberName !== undefined) {
          symbol.componentReferences.add(memberName)
        }
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

      const styledComponentReference = getStyledComponentReferenceName(node)
      if (styledComponentReference !== undefined) {
        symbol.componentReferences.add(styledComponentReference)
      }

      if (includeBuiltins) {
        const styledBuiltinReference = getStyledBuiltinReferenceName(node)
        if (styledBuiltinReference !== undefined) {
          symbol.builtinReferences.add(styledBuiltinReference)
        }
      }
    }

    if (node.type === 'TaggedTemplateExpression') {
      const styledComponentReference = getStyledComponentReferenceName(node)
      if (styledComponentReference !== undefined) {
        symbol.componentReferences.add(styledComponentReference)
      }

      if (includeBuiltins) {
        const styledBuiltinReference = getStyledBuiltinReferenceName(node)
        if (styledBuiltinReference !== undefined) {
          symbol.builtinReferences.add(styledBuiltinReference)
        }
      }
    }
  })
}
