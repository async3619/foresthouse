import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { collectUnusedImports } from './unused.js'

describe('collectUnusedImports', () => {
  it('marks tracked imports that are never referenced', () => {
    const filePath = 'fixture.ts'
    const sourceFile = ts.createSourceFile(
      filePath,
      "import { used, unused } from './dep.js'\nconsole.log(used)\n",
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

    const imports = collectUnusedImports(sourceFile, program.getTypeChecker())

    expect(imports.size).toBe(1)
  })
})
