import process from 'node:process'

import { cac } from 'cac'

import type { ReactUsageFilter } from '../types/react-usage-filter.js'
import type { CliOptions } from './args.js'
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
      this.createCli().parse(this.toProcessArgv())
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
        '<entry-file>',
        'Analyze an entry file and print its dependency tree.',
      )
      .usage('<entry-file> [options]')
      .option('--cwd <path>', 'Working directory used for relative paths.')
      .option(
        '--config <path>',
        'Explicit tsconfig.json or jsconfig.json path.',
      )
      .option(
        '--include-externals',
        'Include packages and Node built-ins in the tree.',
      )
      .option('--no-unused', 'Omit imports that are never referenced.')
      .option(
        '--react [mode]',
        'Print a React usage tree instead of the import tree.',
      )
      .option('--json', 'Print the dependency tree as JSON.')
      .action((entryFile: string, rawOptions: ParsedCliOptions) => {
        runCli(normalizeCliOptions(entryFile, rawOptions))
      })

    cli.help()
    cli.version(this.version)

    return cli
  }

  private toProcessArgv(): string[] {
    return ['node', 'foresthouse', ...this.argv]
  }
}

interface ParsedCliOptions {
  readonly cwd?: string
  readonly config?: string
  readonly includeExternals?: boolean
  readonly unused?: boolean
  readonly json?: boolean
  readonly react?: boolean | string
}

function normalizeCliOptions(
  entryFile: string,
  options: ParsedCliOptions,
): CliOptions {
  return {
    entryFile,
    cwd: options.cwd,
    configPath: options.config,
    includeExternals: options.includeExternals === true,
    omitUnused: options.unused === false,
    json: options.json === true,
    react: normalizeReactOption(options.react),
  }
}

function normalizeReactOption(
  react: ParsedCliOptions['react'],
): ReactUsageFilter | undefined {
  if (react === undefined) {
    return undefined
  }

  if (react === true) {
    return 'all'
  }

  if (react === 'component' || react === 'hook') {
    return react
  }

  throw new Error(`Unknown React mode: ${react}`)
}
