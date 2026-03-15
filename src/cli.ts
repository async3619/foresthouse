#!/usr/bin/env node

import { createRequire } from 'node:module'
import process from 'node:process'

import { analyzeDependencies, graphToSerializableTree } from './analyzer.js'
import { printDependencyTree } from './tree.js'

const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }

interface CliOptions {
  readonly entryFile: string
  readonly cwd: string | undefined
  readonly configPath: string | undefined
  readonly includeExternals: boolean
  readonly json: boolean
}

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2))
    const graph = analyzeDependencies(options.entryFile, {
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      ...(options.configPath === undefined
        ? {}
        : { configPath: options.configPath }),
    })

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(graphToSerializableTree(graph), null, 2)}\n`,
      )
      return
    }

    process.stdout.write(
      `${printDependencyTree(graph, {
        cwd: options.cwd ?? graph.cwd,
        includeExternals: options.includeExternals,
      })}\n`,
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error occurred.'
    process.stderr.write(`foresthouse: ${message}\n`)
    process.exitCode = 1
  }
}

function parseArgs(argv: string[]): CliOptions {
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${version}\n`)
    process.exit(0)
  }

  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printHelp()
    process.exit(0)
  }

  let entryFile: string | undefined
  let cwd: string | undefined
  let configPath: string | undefined
  let includeExternals = false
  let json = false

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

    if (argument === '--json') {
      json = true
      continue
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
    json,
  }
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

function printHelp(): void {
  process.stdout.write(`foresthouse v${version}

Usage:
  foresthouse <entry-file> [options]

Options:
  --cwd <path>               Working directory used for relative paths.
  --config <path>            Explicit tsconfig.json or jsconfig.json path.
  --include-externals        Include packages and Node built-ins in the tree.
  --json                     Print the dependency tree as JSON.
  -v, --version              Show the current version.
  -h, --help                 Show this help message.
`)
}

main()
