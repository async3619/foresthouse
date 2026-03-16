import process from 'node:process'

import { cac } from 'cac'

import type { ReactUsageFilter } from '../types/react-usage-filter.js'
import type { ImportCliOptions, ReactCliOptions } from './args.js'
import { runCli } from './run.js'

export function main(version: string, argv = process.argv.slice(2)): void {
  new CliMain(version, argv).run()
}

class CliMain {
  constructor(
    private readonly version: string,
    private readonly argv: string[],
  ) {}

  run(): void {
    try {
      const cli = this.createCli()

      if (this.argv.length === 0) {
        cli.outputHelp()
        return
      }

      this.validateCommandSyntax()
      cli.parse(this.toProcessArgv())
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred.'
      process.stderr.write(`foresthouse: ${message}\n`)
      process.exitCode = 1
    }
  }

  private createCli() {
    const cli = cac('foresthouse')

    cli
      .command(
        'import [entry-file]',
        'Analyze an entry file and print its dependency tree.',
      )
      .usage('import <entry-file> [options]')
      .option('--entry <path>', 'Entry file to analyze.')
      .option('--cwd <path>', 'Working directory used for relative paths.')
      .option(
        '--config <path>',
        'Explicit tsconfig.json or jsconfig.json path.',
      )
      .option(
        '--include-externals',
        'Include packages and Node built-ins in the tree.',
      )
      .option(
        '--no-workspaces',
        'Do not expand sibling workspace packages into source subtrees.',
      )
      .option(
        '--project-only',
        'Restrict traversal to the active tsconfig.json or jsconfig.json project.',
      )
      .option('--no-unused', 'Omit imports that are never referenced.')
      .option('--json', 'Print the dependency tree as JSON.')
      .action(
        (entryFile: string | undefined, rawOptions: ParsedImportCliOptions) => {
          runCli(normalizeImportCliOptions(entryFile, rawOptions))
        },
      )

    cli
      .command('react [entry-file]', 'Analyze React usage from an entry file.')
      .usage('react [entry-file] [options]')
      .option('--cwd <path>', 'Working directory used for relative paths.')
      .option(
        '--config <path>',
        'Explicit tsconfig.json or jsconfig.json path.',
      )
      .option(
        '--nextjs',
        'Infer Next.js page entries from app/ and pages/ when no entry is provided.',
      )
      .option(
        '--filter <mode>',
        'Limit output to `component` or `hook` usages.',
      )
      .option(
        '--no-workspaces',
        'Do not expand sibling workspace packages into source subtrees.',
      )
      .option(
        '--project-only',
        'Restrict traversal to the active tsconfig.json or jsconfig.json project.',
      )
      .option('--json', 'Print the React usage tree as JSON.')
      .action(
        (entryFile: string | undefined, rawOptions: ParsedReactCliOptions) => {
          runCli(normalizeReactCliOptions(entryFile, rawOptions))
        },
      )

    cli.help()
    cli.version(this.version)

    return cli
  }

  private validateCommandSyntax(): void {
    if (this.argv.length === 0) {
      return
    }

    const firstArgument = this.argv[0]

    if (firstArgument === undefined) {
      return
    }

    if (firstArgument === '--react' || firstArgument.startsWith('--react=')) {
      throw new Error('Unknown option `--react`')
    }

    if (firstArgument.startsWith('-')) {
      return
    }

    if (firstArgument === 'import' || firstArgument === 'react') {
      return
    }

    throw new Error(`Unknown command \`${firstArgument}\``)
  }

  private toProcessArgv(): string[] {
    return ['node', 'foresthouse', ...this.argv]
  }
}

interface ParsedBaseCliOptions {
  readonly cwd?: string
  readonly config?: string
  readonly workspaces?: boolean
  readonly projectOnly?: boolean
  readonly json?: boolean
}

interface ParsedImportCliOptions extends ParsedBaseCliOptions {
  readonly entry?: string
  readonly includeExternals?: boolean
  readonly unused?: boolean
}

interface ParsedReactCliOptions extends ParsedBaseCliOptions {
  readonly filter?: string
  readonly nextjs?: boolean
}

function normalizeImportCliOptions(
  entryFile: string | undefined,
  options: ParsedImportCliOptions,
): ImportCliOptions {
  return {
    command: 'import',
    entryFile: resolveImportEntryFile(entryFile, options.entry),
    cwd: options.cwd,
    configPath: options.config,
    expandWorkspaces: options.workspaces !== false,
    projectOnly: options.projectOnly === true,
    includeExternals: options.includeExternals === true,
    omitUnused: options.unused === false,
    json: options.json === true,
  }
}

function normalizeReactCliOptions(
  entryFile: string | undefined,
  options: ParsedReactCliOptions,
): ReactCliOptions {
  return {
    command: 'react',
    entryFile: resolveReactEntryFile(entryFile, options.nextjs),
    cwd: options.cwd,
    configPath: options.config,
    expandWorkspaces: options.workspaces !== false,
    projectOnly: options.projectOnly === true,
    json: options.json === true,
    filter: normalizeReactFilter(options.filter),
    nextjs: options.nextjs === true,
  }
}

function resolveImportEntryFile(
  positionalEntryFile: string | undefined,
  optionEntryFile: string | undefined,
): string {
  if (
    positionalEntryFile !== undefined &&
    optionEntryFile !== undefined &&
    positionalEntryFile !== optionEntryFile
  ) {
    throw new Error(
      'Provide the import entry only once, either as `foresthouse import <entry-file>` or `foresthouse import --entry <path>`.',
    )
  }

  const resolvedEntryFile = positionalEntryFile ?? optionEntryFile

  if (resolvedEntryFile === undefined) {
    throw new Error(
      'Missing import entry file. Use `foresthouse import <entry-file>` or `foresthouse import --entry <path>`.',
    )
  }

  return resolvedEntryFile
}

function normalizeReactFilter(
  filter: ParsedReactCliOptions['filter'],
): ReactUsageFilter {
  if (filter === undefined) {
    return 'all'
  }

  if (filter === 'component' || filter === 'hook') {
    return filter
  }

  throw new Error(`Unknown React filter: ${filter}`)
}

function resolveReactEntryFile(
  entryFile: string | undefined,
  nextjs: boolean | undefined,
): string | undefined {
  if (entryFile !== undefined) {
    return entryFile
  }

  if (nextjs === true) {
    return undefined
  }

  throw new Error(
    'Missing React entry file. Use `foresthouse react <entry-file>` or `foresthouse react --nextjs`.',
  )
}
