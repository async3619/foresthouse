import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  FunctionBody,
  JSXElement,
  JSXElementName,
  JSXFragment,
  Node,
} from 'oxc-parser'
import { visitorKeys } from 'oxc-parser'

export const FUNCTION_NODE_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
])

export function walkReactUsageTree(
  root: FunctionBody | Expression | JSXFragment | JSXElement,
  visit: (node: Node) => void,
): void {
  walkNode(root, visit, true)
}

export function walkNode(
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

export function isNode(value: unknown): value is Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  )
}

export function classifyReactSymbol(
  name: string,
  declaration: ArrowFunctionExpression | import('oxc-parser').Function,
): import('../../types/react-symbol-kind.js').ReactSymbolKind | undefined {
  if (isHookName(name)) {
    return 'hook'
  }

  if (isComponentName(name) && returnsReactElement(declaration)) {
    return 'component'
  }

  return undefined
}

export function containsReactElementLikeExpression(
  expression: Expression,
): boolean {
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

export function getComponentReferenceName(
  node: JSXElement,
): string | undefined {
  const name = getJsxName(node.openingElement.name)
  return name !== undefined && isComponentName(name) ? name : undefined
}

export function getBuiltinReferenceName(node: JSXElement): string | undefined {
  const name = getJsxName(node.openingElement.name)
  return name !== undefined && isIntrinsicElementName(name) ? name : undefined
}

export function getHookReferenceName(node: CallExpression): string | undefined {
  const calleeName = getIdentifierName(node.callee)
  return calleeName !== undefined && isHookName(calleeName)
    ? calleeName
    : undefined
}

export function getCreateElementComponentReferenceName(
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

export function isHookName(name: string): boolean {
  return /^use[A-Z0-9]/.test(name)
}

export function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name)
}

function isIntrinsicElementName(name: string): boolean {
  return /^[a-z]/.test(name)
}

function returnsReactElement(
  declaration: ArrowFunctionExpression | import('oxc-parser').Function,
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
