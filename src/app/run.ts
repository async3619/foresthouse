import { ImportCommand } from '../commands/import.js'
import { ReactCommand } from '../commands/react.js'
import type { CliOptions } from './args.js'

export function runCli(options: CliOptions): void {
  new CliApplication(options).run()
}

class CliApplication {
  constructor(private readonly options: CliOptions) {}

  run(): void {
    this.createCommand().run()
  }

  private createCommand(): {
    run(): void
  } {
    if (this.options.command === 'react') {
      return new ReactCommand(this.options)
    }

    return new ImportCommand(this.options)
  }
}
