import { analyzeDependencies } from '../analyzers/import/index.js'
import { analyzeReactUsage } from '../analyzers/react/index.js'
import { printDependencyTree } from '../renderers/dependency-tree.js'
import { printReactUsageTree } from '../renderers/react-usage-tree.js'
import { graphToSerializableTree } from '../serializers/dependency-tree.js'
import { graphToSerializableReactTree } from '../serializers/react-usage-tree.js'
import type {
  AnalyzeOptions,
  DependencyGraph,
  ReactUsageFilter,
  ReactUsageGraph,
} from '../types.js'
import type { CliOptions } from './args.js'

export function runCli(options: CliOptions): void {
  new CliApplication(options).run()
}

class CliApplication {
  constructor(private readonly options: CliOptions) {}

  run(): void {
    this.createRunner().run()
  }

  private createRunner(): BaseModeRunner<DependencyGraph | ReactUsageGraph> {
    if (this.options.react !== undefined) {
      return new ReactModeRunner(this.options)
    }

    return new DependencyModeRunner(this.options)
  }
}

abstract class BaseModeRunner<TGraph> {
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

class DependencyModeRunner extends BaseModeRunner<DependencyGraph> {
  protected analyze(): DependencyGraph {
    return analyzeDependencies(this.options.entryFile, this.getAnalyzeOptions())
  }

  protected serialize(graph: DependencyGraph): object {
    return graphToSerializableTree(graph, {
      omitUnused: this.options.omitUnused,
    })
  }

  protected render(graph: DependencyGraph): string {
    return printDependencyTree(graph, {
      cwd: this.options.cwd ?? graph.cwd,
      includeExternals: this.options.includeExternals,
      omitUnused: this.options.omitUnused,
    })
  }
}

class ReactModeRunner extends BaseModeRunner<ReactUsageGraph> {
  protected analyze(): ReactUsageGraph {
    return analyzeReactUsage(this.options.entryFile, this.getAnalyzeOptions())
  }

  protected serialize(graph: ReactUsageGraph): object {
    return graphToSerializableReactTree(graph, {
      filter: this.getFilter(),
    })
  }

  protected render(graph: ReactUsageGraph): string {
    return printReactUsageTree(graph, {
      cwd: this.options.cwd ?? graph.cwd,
      filter: this.getFilter(),
    })
  }

  private getFilter(): ReactUsageFilter {
    return this.options.react ?? 'all'
  }
}
