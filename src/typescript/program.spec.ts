import { describe, expect, it } from 'vitest'

import {
  createModuleResolutionHost,
  createProgram,
  createSourceFile,
} from './program.js'

describe('typescript program helpers', () => {
  it('exports program creation helpers', () => {
    expect(createProgram).toBeTypeOf('function')
    expect(createSourceFile).toBeTypeOf('function')
    expect(createModuleResolutionHost).toBeTypeOf('function')
  })
})
