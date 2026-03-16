import process from 'node:process'

import type { ReactUsageFilter } from '../types.js'

export interface CliOptions {
  readonly entryFile: string
  readonly cwd: string | undefined
  readonly configPath: string | undefined
  readonly includeExternals: boolean
  readonly omitUnused: boolean
  readonly json: boolean
  readonly react: ReactUsageFilter | undefined
}

export function parseArgs(argv: string[], version: string): CliOptions {
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${version}\n`)
    process.exit(0)
  }

  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printHelp(version)
    process.exit(0)
  }

  let entryFile: string | undefined
  let cwd: string | undefined
  let configPath: string | undefined
  let includeExternals = false
  let omitUnused = false
  let json = false
  let react: ReactUsageFilter | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === undefined) {
      continue
    }

    if (argument === '--cwd') {
      cwd = readOptionValue(argv, index, '--cwd')
      index += 1
      continue
    }

    if (argument === '--config') {
      configPath = readOptionValue(argv, index, '--config')
      index += 1
      continue
    }

    if (argument === '--include-externals') {
      includeExternals = true
      continue
    }

    if (argument === '--no-unused') {
      omitUnused = true
      continue
    }

    if (argument === '--json') {
      json = true
      continue
    }

    if (argument === '--react') {
      react = 'all'
      continue
    }

    if (argument.startsWith('--react=')) {
      const value = argument.slice('--react='.length)
      if (value === 'component' || value === 'hook') {
        react = value
        continue
      }

      throw new Error(`Unknown React mode: ${value}`)
    }

    if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`)
    }

    if (entryFile !== undefined) {
      throw new Error('Only one entry file can be provided.')
    }

    entryFile = argument
  }

  if (entryFile === undefined) {
    throw new Error('An entry file is required.')
  }

  return {
    entryFile,
    cwd,
    configPath,
    includeExternals,
    omitUnused,
    json,
    react,
  }
}

export function printHelp(version: string): void {
  process.stdout.write(`foresthouse v${version}

Usage:
  foresthouse <entry-file> [options]

Options:
  --cwd <path>               Working directory used for relative paths.
  --config <path>            Explicit tsconfig.json or jsconfig.json path.
  --include-externals        Include packages and Node built-ins in the tree.
  --no-unused                Omit imports that are never referenced.
  --react[=component|hook]   Print a React usage tree instead of the import tree.
  --json                     Print the dependency tree as JSON.
  -v, --version              Show the current version.
  -h, --help                 Show this help message.
`)
}

function readOptionValue(
  argv: string[],
  index: number,
  optionName: string,
): string {
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('-')) {
    throw new Error(`Missing value for ${optionName}`)
  }

  return value
}
