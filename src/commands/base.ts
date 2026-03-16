import type { CliOptions } from '../app/args.js'
import type { AnalyzeOptions } from '../types.js'

export abstract class BaseCommand<TGraph> {
  constructor(protected readonly options: CliOptions) {}

  run(): void {
    const graph = this.analyze()

    if (this.isJsonMode()) {
      process.stdout.write(
        `${JSON.stringify(this.serialize(graph), null, 2)}\n`,
      )
      return
    }

    process.stdout.write(`${this.render(graph)}\n`)
  }

  protected isJsonMode(): boolean {
    return this.options.json
  }

  protected getAnalyzeOptions(): AnalyzeOptions {
    return {
      ...(this.options.cwd === undefined ? {} : { cwd: this.options.cwd }),
      ...(this.options.configPath === undefined
        ? {}
        : { configPath: this.options.configPath }),
    }
  }

  protected abstract analyze(): TGraph
  protected abstract serialize(graph: TGraph): object
  protected abstract render(graph: TGraph): string
}
