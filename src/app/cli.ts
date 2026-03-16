import process from 'node:process'

import { parseArgs } from './args.js'
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
      runCli(parseArgs(this.argv, this.version))
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error occurred.'
      process.stderr.write(`foresthouse: ${message}\n`)
      process.exitCode = 1
    }
  }
}
