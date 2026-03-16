import { ImportRunner } from '../runners/import.js'
import { ReactRunner } from '../runners/react.js'
import type { CliOptions } from './args.js'

export function runCli(options: CliOptions): void {
  new CliApplication(options).run()
}

class CliApplication {
  constructor(private readonly options: CliOptions) {}

  run(): void {
    this.createRunner().run()
  }

  private createRunner(): {
    run(): void
  } {
    if (this.options.react !== undefined) {
      return new ReactRunner(this.options)
    }

    return new ImportRunner(this.options)
  }
}
