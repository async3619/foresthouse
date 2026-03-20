import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { collectModuleReferences } from './references.js'

describe('collectModuleReferences', () => {
  it('collects static and dynamic module references', () => {
    const filePath = 'fixture.ts'
    const sourceFile = ts.createSourceFile(
      filePath,
      [
        "import { thing } from './dep.js'",
        "export * from './exports.js'",
        "const value = require('./required.js')",
        "void import('./dynamic.js')",
        'console.log(thing, value)',
      ].join('\n'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )
    const host = ts.createCompilerHost({})
    host.getSourceFile = (target) =>
      target === filePath ? sourceFile : undefined
    host.readFile = () => sourceFile.text
    host.fileExists = (target) => target === filePath
    const program = ts.createProgram({
      rootNames: [filePath],
      options: {},
      host,
    })

    expect(
      collectModuleReferences(sourceFile, program.getTypeChecker()).map(
        (reference) => reference.specifier,
      ),
    ).toEqual(['./dep.js', './exports.js', './required.js', './dynamic.js'])
  })

  it('collects references without tracking unused imports when no checker is given', () => {
    const sourceFile = ts.createSourceFile(
      'fixture.ts',
      [
        "import { thing } from './dep.js'",
        "export * from './exports.js'",
        'console.log(thing)',
      ].join('\n'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    expect(collectModuleReferences(sourceFile)).toEqual([
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
