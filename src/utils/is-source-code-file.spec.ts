import { describe, expect, it } from 'vitest'

import { isSourceCodeFile, SOURCE_EXTENSIONS } from './is-source-code-file.js'

describe('isSourceCodeFile', () => {
  it('accepts the supported source extensions', () => {
    expect([...SOURCE_EXTENSIONS]).toEqual([
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.mjs',
      '.cjs',
      '.mts',
      '.cts',
    ])

    expect(isSourceCodeFile('src/main.ts')).toBe(true)
    expect(isSourceCodeFile('src/component.TSX')).toBe(true)
    expect(isSourceCodeFile('src/module.mjs')).toBe(true)
  })

  it('matches file extensions without inferring higher-level semantics', () => {
    expect(isSourceCodeFile('src/types.d.ts')).toBe(true)
    expect(isSourceCodeFile('package.json')).toBe(false)
    expect(isSourceCodeFile('styles.css')).toBe(false)
  })
})
