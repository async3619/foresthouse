import { analyzeDependencies } from '../analyzers/import/index.js'
import { analyzeReactUsage } from '../analyzers/react/index.js'
import { printDependencyTree } from '../renderers/dependency-tree.js'
import { printReactUsageTree } from '../renderers/react-usage-tree.js'
import { graphToSerializableTree } from '../serializers/dependency-tree.js'
import { graphToSerializableReactTree } from '../serializers/react-usage-tree.js'
import type { CliOptions } from './args.js'

export function runCli(options: CliOptions): void {
  new CliApplication(options).run()
}

class CliApplication {
  constructor(private readonly options: CliOptions) {}

  run(): void {
    if (this.options.react !== undefined) {
      this.runReactMode()
      return
    }

    this.runDependencyMode()
  }

  private runReactMode(): void {
    const filter = this.options.react ?? 'all'
    const graph = analyzeReactUsage(
      this.options.entryFile,
      this.getAnalyzeOptions(),
    )

    if (this.options.json) {
      process.stdout.write(
        `${JSON.stringify(
          graphToSerializableReactTree(graph, {
            filter,
          }),
          null,
          2,
        )}\n`,
      )
      return
    }

    process.stdout.write(
      `${printReactUsageTree(graph, {
        cwd: this.options.cwd ?? graph.cwd,
        filter,
      })}\n`,
    )
  }

  private runDependencyMode(): void {
    const graph = analyzeDependencies(
      this.options.entryFile,
      this.getAnalyzeOptions(),
    )

    if (this.options.json) {
      process.stdout.write(
        `${JSON.stringify(
          graphToSerializableTree(graph, {
            omitUnused: this.options.omitUnused,
          }),
          null,
          2,
        )}\n`,
      )
      return
    }

    process.stdout.write(
      `${printDependencyTree(graph, {
        cwd: this.options.cwd ?? graph.cwd,
        includeExternals: this.options.includeExternals,
        omitUnused: this.options.omitUnused,
      })}\n`,
    )
  }

  private getAnalyzeOptions(): {
    readonly cwd?: string
    readonly configPath?: string
  } {
    return {
      ...(this.options.cwd === undefined ? {} : { cwd: this.options.cwd }),
      ...(this.options.configPath === undefined
        ? {}
        : { configPath: this.options.configPath }),
    }
  }
}
