import { DependencyModeRunner } from '../runners/dependency-mode.js'
import { ReactModeRunner } from '../runners/react-mode.js'
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
      return new ReactModeRunner(this.options)
    }

    return new DependencyModeRunner(this.options)
  }
}
