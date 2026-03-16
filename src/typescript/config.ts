import path from 'node:path'
import ts from 'typescript'

export interface LoadedConfig {
  readonly path?: string
  readonly compilerOptions: ts.CompilerOptions
}

export function loadCompilerOptions(
  searchFrom: string,
  explicitConfigPath?: string,
): LoadedConfig {
  const configPath =
    explicitConfigPath === undefined
      ? findNearestConfig(searchFrom)
      : path.resolve(searchFrom, explicitConfigPath)

  if (configPath === undefined) {
    return {
      compilerOptions: defaultCompilerOptions(),
    }
  }

  const readResult = ts.readConfigFile(configPath, ts.sys.readFile)
  if (readResult.error !== undefined) {
    throw new Error(
      `Failed to read TypeScript config at ${configPath}: ${formatDiagnostic(
        readResult.error,
      )}`,
    )
  }

  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    path.dirname(configPath),
    defaultCompilerOptions(),
    configPath,
  )

  if (parsed.errors.length > 0) {
    const [firstError] = parsed.errors
    if (firstError === undefined) {
      throw new Error(`Failed to parse TypeScript config at ${configPath}.`)
    }

    throw new Error(
      `Failed to parse TypeScript config at ${configPath}: ${formatDiagnostic(
        firstError,
      )}`,
    )
  }

  return {
    path: configPath,
    compilerOptions: parsed.options,
  }
}

function findNearestConfig(searchFrom: string): string | undefined {
  let currentDirectory = path.resolve(searchFrom)

  while (true) {
    if (!isInsideNodeModules(currentDirectory)) {
      const tsconfigPath = path.join(currentDirectory, 'tsconfig.json')
      if (ts.sys.fileExists(tsconfigPath)) {
        return tsconfigPath
      }

      const jsconfigPath = path.join(currentDirectory, 'jsconfig.json')
      if (ts.sys.fileExists(jsconfigPath)) {
        return jsconfigPath
      }
    }

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) {
      return undefined
    }

    currentDirectory = parentDirectory
  }
}

function defaultCompilerOptions(): ts.CompilerOptions {
  return {
    allowJs: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ESNext,
    resolveJsonModule: true,
    esModuleInterop: true,
  }
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
}

function isInsideNodeModules(filePath: string): boolean {
  return filePath.includes(`${path.sep}node_modules${path.sep}`)
}
