import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export function createProgram(
  entryFile: string,
  compilerOptions: ts.CompilerOptions,
  currentDirectory: string,
): ts.Program {
  const host = ts.createCompilerHost(compilerOptions, true)
  host.getCurrentDirectory = () => currentDirectory

  if (ts.sys.realpath !== undefined) {
    host.realpath = ts.sys.realpath
  }

  return ts.createProgram({
    rootNames: [entryFile],
    options: compilerOptions,
    host,
  })
}

export function createSourceFile(filePath: string): ts.SourceFile {
  const sourceText = fs.readFileSync(filePath, 'utf8')
  return ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  )
}

export function createModuleResolutionHost(
  currentDirectory: string,
): ts.ModuleResolutionHost {
  return {
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    directoryExists: ts.sys.directoryExists,
    getCurrentDirectory: () => currentDirectory,
    getDirectories: ts.sys.getDirectories,
    ...(ts.sys.realpath === undefined ? {} : { realpath: ts.sys.realpath }),
  }
}

function getScriptKind(filePath: string): ts.ScriptKind {
  switch (path.extname(filePath).toLowerCase()) {
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS
    case '.jsx':
      return ts.ScriptKind.JSX
    case '.tsx':
      return ts.ScriptKind.TSX
    case '.json':
      return ts.ScriptKind.JSON
    default:
      return ts.ScriptKind.TS
  }
}
