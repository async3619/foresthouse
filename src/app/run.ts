import { analyzeDependencies } from '../analyzers/import/index.js'
import { analyzeReactUsage } from '../analyzers/react/index.js'
import { printDependencyTree } from '../renderers/dependency-tree.js'
import { printReactUsageTree } from '../renderers/react-usage-tree.js'
import { graphToSerializableTree } from '../serializers/dependency-tree.js'
import { graphToSerializableReactTree } from '../serializers/react-usage-tree.js'
import type { CliOptions } from './args.js'

export function runCli(options: CliOptions): void {
  if (options.react !== undefined) {
    const graph = analyzeReactUsage(options.entryFile, {
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      ...(options.configPath === undefined
        ? {}
        : { configPath: options.configPath }),
    })

    if (options.json) {
      process.stdout.write(
        `${JSON.stringify(
          graphToSerializableReactTree(graph, {
            filter: options.react,
          }),
          null,
          2,
        )}\n`,
      )
      return
    }

    process.stdout.write(
      `${printReactUsageTree(graph, {
        cwd: options.cwd ?? graph.cwd,
        filter: options.react,
      })}\n`,
    )
    return
  }

  const graph = analyzeDependencies(options.entryFile, {
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    ...(options.configPath === undefined
      ? {}
      : { configPath: options.configPath }),
  })

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        graphToSerializableTree(graph, {
          omitUnused: options.omitUnused,
        }),
        null,
        2,
      )}\n`,
    )
    return
  }

  process.stdout.write(
    `${printDependencyTree(graph, {
      cwd: options.cwd ?? graph.cwd,
      includeExternals: options.includeExternals,
      omitUnused: options.omitUnused,
    })}\n`,
  )
}
