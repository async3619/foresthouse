import { parseSync } from 'oxc-parser'
import { describe, expect, it } from 'vitest'

import {
  classifyReactSymbol,
  containsReactElementLikeExpression,
  FUNCTION_NODE_TYPES,
  getBuiltinReferenceName,
  getComponentReferenceName,
  getCreateElementComponentReferenceName,
  getHookReferenceName,
  getMemberExpressionComponentReferenceName,
  getStyledBuiltinReferenceName,
  getStyledComponentReferenceName,
  isComponentName,
  isHookName,
  isNode,
  walkNode,
  walkReactUsageTree,
} from './walk.js'

function parseExpression(code: string) {
  const { program } = parseSync('test.tsx', code)
  const stmt = program.body[0]
  if (stmt.type === 'ExpressionStatement') return stmt.expression
  throw new Error(`Expected ExpressionStatement, got ${stmt.type}`)
}

function parseStatement(code: string) {
  const { program } = parseSync('test.tsx', code)
  return program.body[0]
}

function parseJSXElement(code: string) {
  const expr = parseExpression(code)
  if (expr.type === 'JSXElement') return expr
  throw new Error(`Expected JSXElement, got ${expr.type}`)
}

function parseCallExpression(code: string) {
  const expr = parseExpression(code)
  if (expr.type === 'CallExpression') return expr
  throw new Error(`Expected CallExpression, got ${expr.type}`)
}

describe('react walk helpers', () => {
  describe('isHookName', () => {
    it('returns true for valid hook names', () => {
      expect(isHookName('useState')).toBe(true)
      expect(isHookName('useEffect')).toBe(true)
      expect(isHookName('use1')).toBe(true)
      expect(isHookName('useMyCustomHook')).toBe(true)
    })

    it('returns false for non-hook names', () => {
      expect(isHookName('used')).toBe(false)
      expect(isHookName('user')).toBe(false)
      expect(isHookName('hook')).toBe(false)
      expect(isHookName('Use')).toBe(false)
      expect(isHookName('usedEffect')).toBe(false)
    })
  })

  describe('isComponentName', () => {
    it('returns true for names starting with uppercase', () => {
      expect(isComponentName('App')).toBe(true)
      expect(isComponentName('MyComponent')).toBe(true)
      expect(isComponentName('A')).toBe(true)
    })

    it('returns false for names starting with lowercase', () => {
      expect(isComponentName('app')).toBe(false)
      expect(isComponentName('myComponent')).toBe(false)
      expect(isComponentName('_App')).toBe(false)
    })
  })

  describe('FUNCTION_NODE_TYPES', () => {
    it('includes all function-like node types', () => {
      expect(FUNCTION_NODE_TYPES.has('FunctionDeclaration')).toBe(true)
      expect(FUNCTION_NODE_TYPES.has('FunctionExpression')).toBe(true)
      expect(FUNCTION_NODE_TYPES.has('ArrowFunctionExpression')).toBe(true)
      expect(FUNCTION_NODE_TYPES.has('TSDeclareFunction')).toBe(true)
      expect(FUNCTION_NODE_TYPES.has('TSEmptyBodyFunctionExpression')).toBe(
        true,
      )
    })
  })

  describe('isNode', () => {
    it('returns true for objects with a string type property', () => {
      expect(isNode({ type: 'Identifier' })).toBe(true)
      expect(isNode({ type: 'JSXElement', children: [] })).toBe(true)
    })

    it('returns false for non-node values', () => {
      expect(isNode(null)).toBe(false)
      expect(isNode(undefined)).toBe(false)
      expect(isNode(42)).toBe(false)
      expect(isNode('string')).toBe(false)
      expect(isNode({ type: 42 })).toBe(false)
      expect(isNode({})).toBe(false)
    })
  })

  describe('getComponentReferenceName', () => {
    it('returns component name from JSX element', () => {
      const element = parseJSXElement('<MyComponent />')
      expect(getComponentReferenceName(element)).toBe('MyComponent')
    })

    it('returns undefined for builtin elements', () => {
      const element = parseJSXElement('<div />')
      expect(getComponentReferenceName(element)).toBeUndefined()
    })

    it('returns undefined for member expressions', () => {
      const element = parseJSXElement('<Ns.Item />')
      expect(getComponentReferenceName(element)).toBeUndefined()
    })
  })

  describe('getMemberExpressionComponentReferenceName', () => {
    it('returns dotted name from member expression JSX', () => {
      const element = parseJSXElement('<Ns.Item />')
      expect(getMemberExpressionComponentReferenceName(element)).toBe('Ns.Item')
    })

    it('returns undefined for simple JSX elements', () => {
      const element = parseJSXElement('<MyComponent />')
      expect(getMemberExpressionComponentReferenceName(element)).toBeUndefined()
    })

    it('returns undefined when object is not a component name', () => {
      const element = parseJSXElement('<ns.item />')
      expect(getMemberExpressionComponentReferenceName(element)).toBeUndefined()
    })
  })

  describe('getBuiltinReferenceName', () => {
    it('returns builtin element name', () => {
      const element = parseJSXElement('<div />')
      expect(getBuiltinReferenceName(element)).toBe('div')
    })

    it('returns undefined for component elements', () => {
      const element = parseJSXElement('<App />')
      expect(getBuiltinReferenceName(element)).toBeUndefined()
    })
  })

  describe('getHookReferenceName', () => {
    it('returns hook name from call expression', () => {
      const call = parseCallExpression('useState(0)')
      expect(getHookReferenceName(call)).toBe('useState')
    })

    it('returns undefined for non-hook calls', () => {
      const call = parseCallExpression('getData()')
      expect(getHookReferenceName(call)).toBeUndefined()
    })
  })

  describe('getCreateElementComponentReferenceName', () => {
    it('returns component name from React.createElement', () => {
      const call = parseCallExpression('React.createElement(MyComp, null)')
      expect(getCreateElementComponentReferenceName(call)).toBe('MyComp')
    })

    it('returns undefined for non-createElement calls', () => {
      const call = parseCallExpression('someFunc(MyComp)')
      expect(getCreateElementComponentReferenceName(call)).toBeUndefined()
    })

    it('returns undefined when first arg is not a component identifier', () => {
      const call = parseCallExpression('React.createElement("div", null)')
      expect(getCreateElementComponentReferenceName(call)).toBeUndefined()
    })
  })

  describe('getStyledComponentReferenceName', () => {
    it('returns component name from styled(Component) call', () => {
      const call = parseCallExpression('styled(Button)({})')
      expect(getStyledComponentReferenceName(call)).toBe('Button')
    })

    it('returns component name from styled.Component member', () => {
      const expr = parseExpression('styled.Button``')
      if (expr.type === 'TaggedTemplateExpression') {
        expect(getStyledComponentReferenceName(expr)).toBe('Button')
      }
    })

    it('returns undefined for styled.div (builtin)', () => {
      const expr = parseExpression('styled.div``')
      if (expr.type === 'TaggedTemplateExpression') {
        expect(getStyledComponentReferenceName(expr)).toBeUndefined()
      }
    })
  })

  describe('getStyledBuiltinReferenceName', () => {
    it('returns builtin name from styled.div', () => {
      const expr = parseExpression('styled.div``')
      if (expr.type === 'TaggedTemplateExpression') {
        expect(getStyledBuiltinReferenceName(expr)).toBe('div')
      }
    })

    it('returns undefined for styled.Component', () => {
      const expr = parseExpression('styled.Button``')
      if (expr.type === 'TaggedTemplateExpression') {
        expect(getStyledBuiltinReferenceName(expr)).toBeUndefined()
      }
    })
  })

  describe('classifyReactSymbol', () => {
    it('classifies hook from arrow function', () => {
      const stmt = parseStatement('const useData = () => { return null }')
      if (
        stmt.type === 'VariableDeclaration' &&
        stmt.declarations[0].init !== null
      ) {
        expect(
          classifyReactSymbol('useData', stmt.declarations[0].init as never),
        ).toBe('hook')
      }
    })

    it('classifies component from function returning JSX', () => {
      const stmt = parseStatement('function App() { return <div /> }')
      if (stmt.type === 'FunctionDeclaration') {
        expect(classifyReactSymbol('App', stmt as never)).toBe('component')
      }
    })

    it('classifies component from styled-component expression', () => {
      const stmt = parseStatement('const Button = styled.button``')
      if (
        stmt.type === 'VariableDeclaration' &&
        stmt.declarations[0].init !== null
      ) {
        expect(
          classifyReactSymbol('Button', stmt.declarations[0].init as never),
        ).toBe('component')
      }
    })

    it('returns undefined for non-react function', () => {
      const stmt = parseStatement('function helper() { return 42 }')
      if (stmt.type === 'FunctionDeclaration') {
        expect(classifyReactSymbol('helper', stmt as never)).toBeUndefined()
      }
    })

    it('returns undefined for component name with non-JSX return', () => {
      const stmt = parseStatement('function App() { return 42 }')
      if (stmt.type === 'FunctionDeclaration') {
        expect(classifyReactSymbol('App', stmt as never)).toBeUndefined()
      }
    })
  })

  describe('containsReactElementLikeExpression', () => {
    it('returns true for JSX element', () => {
      const expr = parseExpression('<div />')
      expect(containsReactElementLikeExpression(expr)).toBe(true)
    })

    it('returns true for JSX fragment', () => {
      const expr = parseExpression('<></>')
      expect(containsReactElementLikeExpression(expr)).toBe(true)
    })

    it('returns true for React.createElement call', () => {
      const expr = parseExpression('React.createElement("div")')
      expect(containsReactElementLikeExpression(expr)).toBe(true)
    })

    it('returns false for plain expression', () => {
      const expr = parseExpression('42')
      expect(containsReactElementLikeExpression(expr)).toBe(false)
    })
  })

  describe('walkReactUsageTree', () => {
    it('visits nodes in the tree', () => {
      const { program } = parseSync(
        'test.tsx',
        'function App() { return <div /> }',
      )
      const funcDecl = program.body[0]
      if (funcDecl.type !== 'FunctionDeclaration' || funcDecl.body === null) {
        throw new Error('unexpected')
      }

      const types: string[] = []
      walkReactUsageTree(funcDecl.body, (node) => {
        types.push(node.type)
      })

      expect(types).toContain('ReturnStatement')
      expect(types).toContain('JSXElement')
    })
  })

  describe('walkNode', () => {
    it('skips nested function bodies when allowNestedFunctions is false', () => {
      const { program } = parseSync(
        'test.tsx',
        'function outer() { const inner = () => { return <span /> }; return <div /> }',
      )
      const funcDecl = program.body[0]
      if (funcDecl.type !== 'FunctionDeclaration' || funcDecl.body === null) {
        throw new Error('unexpected')
      }

      const types: string[] = []
      walkNode(
        funcDecl.body,
        (node) => {
          if (node.type === 'JSXElement') types.push('JSXElement')
        },
        false,
      )

      expect(types).toHaveLength(1)
    })

    it('visits nested functions when allowNestedFunctions is true', () => {
      const { program } = parseSync(
        'test.tsx',
        '() => { const inner = () => { return <span /> }; return <div /> }',
      )
      const stmt = program.body[0]
      if (stmt.type !== 'ExpressionStatement') throw new Error('unexpected')
      const arrow = stmt.expression
      if (arrow.type !== 'ArrowFunctionExpression')
        throw new Error('unexpected')

      const jsxCount: string[] = []
      walkReactUsageTree(arrow.body as never, (node) => {
        if (node.type === 'JSXElement') jsxCount.push('JSXElement')
      })

      expect(jsxCount.length).toBeGreaterThanOrEqual(1)
    })
  })
})
