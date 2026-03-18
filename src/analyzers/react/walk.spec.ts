import { describe, expect, it } from 'vitest'

import {
  classifyReactSymbol,
  FUNCTION_NODE_TYPES,
  isComponentName,
  isHookName,
} from './walk.js'

describe('react walk helpers', () => {
  it('classifies naming conventions for hooks and components', () => {
    expect(FUNCTION_NODE_TYPES.has('FunctionDeclaration')).toBe(true)
    expect(isHookName('useFeature')).toBe(true)
    expect(isComponentName('AppShell')).toBe(true)
    expect(
      classifyReactSymbol('useFeature', {
        type: 'ArrowFunctionExpression',
        body: { type: 'JSXElement' },
      } as never),
    ).toBe('hook')
  })
})
