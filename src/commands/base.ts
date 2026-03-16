import type { CliOptions } from '../app/args.js'
import type { AnalyzeOptions } from '../types/analyze-options.js'

export abstract class BaseCommand<
  TGraph,
  TOptions extends CliOptions = CliOptions,
> {
  constructor(protected readonly options: TOptions) {}

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
      expandWorkspaces: this.options.expandWorkspaces,
      projectOnly: this.options.projectOnly,
    }
  }

  protected abstract analyze(): TGraph
  protected abstract serialize(graph: TGraph): object
  protected abstract render(graph: TGraph): string
}
