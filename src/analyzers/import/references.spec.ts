import { describe, expect, it } from 'vitest'

import { collectModuleReferences } from './references.js'

describe('collectModuleReferences', () => {
  it('collects static and dynamic module references', () => {
    const sourceText = [
      "import { thing } from './dep.js'",
      "export * from './exports.js'",
      "const value = require('./required.js')",
      "void import('./dynamic.js')",
      'console.log(thing, value)',
    ].join('\n')

    expect(
      collectModuleReferences('fixture.ts', sourceText, true).map(
        (reference) => reference.specifier,
      ),
    ).toEqual(['./dep.js', './exports.js', './dynamic.js', './required.js'])
  })

  it('collects references without tracking unused imports', () => {
    const sourceText = [
      "import { thing } from './dep.js'",
      "export * from './exports.js'",
      'console.log(thing)',
    ].join('\n')

    expect(collectModuleReferences('fixture.ts', sourceText, false)).toEqual([
      {
        specifier: './dep.js',
        referenceKind: 'import',
        isTypeOnly: false,
        unused: false,
      },
      {
        specifier: './exports.js',
        referenceKind: 'export',
        isTypeOnly: false,
        unused: false,
      },
    ])
  })
})
