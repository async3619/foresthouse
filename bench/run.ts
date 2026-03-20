import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import {
  type BenchmarkDefinition,
  type BenchmarkId,
  type BenchmarkProject,
  type BenchmarkSize,
  type BenchmarkTopology,
  benchmarkDefinitions,
  benchmarkProjects,
  defaultEntryCandidates,
  type ProjectBenchmark,
} from './config.js'

interface ParsedArgs {
  benchmarkIds: BenchmarkId[]
  cloneDir: string | undefined
  help: boolean
  installConcurrency: number
  iterations: number
  list: boolean
  listBenchmarks: boolean
  listProjects: boolean
  prepareConcurrency: number
  projects: string[]
  resultsFile: string | undefined
  skipInstall: boolean
  sizes: BenchmarkSize[]
  topologies: BenchmarkTopology[]
}

type PackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'

interface InstallPlan {
  args: string[]
  packageManager: PackageManager
}

interface RepositoryState {
  commit: string
}

interface PreparedProject {
  loc: number
  project: BenchmarkProject
  projectBenchmarks: ProjectBenchmark[]
  repoDir: string
  repoState: RepositoryState
}

interface CommandResult {
  exitCode: number
  stderr: string
  stdout: string
}

class CommandExecutionError extends Error {
  stderr: string
  stdout: string

  constructor(command: string, commandArgs: string[], result: CommandResult) {
    super(
      [
        `Command failed: ${command} ${commandArgs.join(' ')}`,
        result.stderr.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    )
    this.name = 'CommandExecutionError'
    this.stderr = result.stderr
    this.stdout = result.stdout
  }
}

interface RunCommandOptions {
  allowFailure?: boolean
  cwd?: string
  maxBuffer?: number
}

interface BenchmarkIteration {
  args: string[]
  durationMs: number
  exitCode: number
  stderr: string
  stderrBytes: number
  stdout: string
  stdoutBytes: number
}

interface BenchmarkSummary {
  avgMs: number | undefined
  maxMs: number | undefined
  medianMs: number | undefined
  minMs: number | undefined
  p90Ms: number | undefined
  p95Ms: number | undefined
  p99Ms: number | undefined
  successfulRuns: number
}

interface BenchmarkRunRecord {
  benchmarkId: BenchmarkId
  command: BenchmarkDefinition['command']
  commit: string
  cwd: string
  directory: string | undefined
  entryFile: string | undefined
  iterations: BenchmarkIteration[] | undefined
  loc: number
  projectId: string
  reason: string | undefined
  repo: string
  status: 'failed' | 'ok' | 'skipped'
  summary: BenchmarkSummary | undefined
  target: BenchmarkDefinition['target']
}

interface ResultsFile {
  cloneRoot: string
  environment: BenchmarkEnvironment
  filters: {
    benchmarks: string[]
    iterations: number
    projects: string[]
    sizes: BenchmarkSize[]
    topologies: BenchmarkTopology[]
  }
  foresthouseCliPath: string
  generatedAt: string
  runs: BenchmarkRunRecord[]
}

interface BenchmarkEnvironment {
  cpuCores: number
  cpuModel: string
  nodeVersion: string
  platform: string
  totalMemoryGb: string
}

interface BenchmarkInvocation {
  benchmarkDefinition: BenchmarkDefinition
  directory: string | undefined
  entryFile: string | undefined
  foresthouseCliPath: string
  projectCwd: string
}

const projectById = new Map(
  benchmarkProjects.map((project) => [project.id, project] as const),
)

void main().catch(handleFatalError)

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    process.exit(0)
  }

  if (args.listProjects || args.list) {
    printProjects()
  }

  if (args.listBenchmarks || args.list) {
    printBenchmarks()
  }

  if (args.list || args.listProjects || args.listBenchmarks) {
    process.exit(0)
  }

  const repoRoot = process.cwd()
  const cloneRoot = path.resolve(
    args.cloneDir ?? path.join(repoRoot, 'bench', 'repos'),
  )
  const resultsRoot = path.resolve(path.join(repoRoot, 'bench', 'results'))
  const foresthouseCliPath = path.join(repoRoot, 'dist', 'cli.mjs')

  await ensureFileExists(
    foresthouseCliPath,
    [
      'Missing dist/cli.mjs.',
      'Run `pnpm build` first or rerun after building the CLI.',
    ].join(' '),
  )

  const requestedBenchmarkIds = getRequestedBenchmarkIds(args.benchmarkIds)
  const selectedProjects = getSelectedProjects(args)
  const selectedProjectEntries = selectedProjects
    .map((project) => ({
      project,
      projectBenchmarks: getProjectBenchmarks(project, requestedBenchmarkIds),
    }))
    .filter((entry) => entry.projectBenchmarks.length > 0)

  if (selectedProjectEntries.length === 0) {
    throw new Error('No projects matched the given filters.')
  }

  process.stdout.write('\nSelected benchmark matrix:\n')
  printBenchmarkMatrix(
    selectedProjectEntries.map((entry) => entry.project),
    requestedBenchmarkIds,
  )

  await fs.mkdir(cloneRoot, { recursive: true })
  await fs.mkdir(resultsRoot, { recursive: true })

  const results: ResultsFile = {
    cloneRoot,
    environment: collectBenchmarkEnvironment(),
    filters: {
      benchmarks: requestedBenchmarkIds,
      iterations: args.iterations,
      projects: args.projects,
      sizes: args.sizes,
      topologies: args.topologies,
    },
    foresthouseCliPath,
    generatedAt: new Date().toISOString(),
    runs: [],
  }

  process.stdout.write(
    `\nPreparing repositories (clone concurrency: ${args.prepareConcurrency}, install concurrency: ${args.installConcurrency})\n`,
  )

  const preparedProjects: PreparedProject[] = await mapWithConcurrency(
    selectedProjectEntries,
    args.prepareConcurrency,
    async ({ project, projectBenchmarks }) => {
      const repoDir = path.join(cloneRoot, project.id)
      process.stdout.write(`[clone] ${project.id} <- ${project.repo}\n`)
      const repoState = await ensureRepository(project, repoDir)
      const loc = await countProjectSourceLines(path.join(repoDir, project.cwd))
      return {
        loc,
        project,
        projectBenchmarks,
        repoDir,
        repoState,
      }
    },
  )

  if (!args.skipInstall) {
    await mapWithConcurrency(
      preparedProjects,
      args.installConcurrency,
      async ({ project, repoDir }) => {
        await ensureDependenciesInstalled({
          project,
          repoDir,
        })
      },
    )
  }

  for (const {
    project,
    projectBenchmarks,
    repoDir,
    repoState,
    loc,
  } of preparedProjects) {
    const projectCwd = path.join(repoDir, project.cwd)

    for (const projectBenchmark of projectBenchmarks) {
      const benchmarkDefinition = getBenchmarkDefinition(projectBenchmark.id)
      process.stdout.write(`[bench] ${projectBenchmark.id} @ ${project.id}\n`)

      const benchmarkTarget = await resolveBenchmarkTarget({
        benchmarkDefinition,
        project,
        projectBenchmark,
        projectCwd,
      })

      if (benchmarkTarget.status === 'skipped') {
        results.runs.push({
          benchmarkId: projectBenchmark.id,
          command: benchmarkDefinition.command,
          commit: repoState.commit,
          cwd: project.cwd,
          directory: benchmarkTarget.directory,
          entryFile: benchmarkTarget.entryFile,
          iterations: undefined,
          loc,
          projectId: project.id,
          reason: benchmarkTarget.reason,
          repo: project.repo,
          status: 'skipped',
          summary: undefined,
          target: benchmarkDefinition.target,
        })
        process.stdout.write(`  skipped: ${benchmarkTarget.reason}\n`)
        continue
      }

      const iterations: BenchmarkIteration[] = []
      for (let iteration = 1; iteration <= args.iterations; iteration += 1) {
        const benchmarkRun = await runForesthouseBenchmark({
          benchmarkDefinition,
          directory: benchmarkTarget.directory,
          entryFile: benchmarkTarget.entryFile,
          foresthouseCliPath,
          projectCwd,
        })
        iterations.push(benchmarkRun)
        const suffix =
          benchmarkRun.exitCode === 0
            ? `${benchmarkRun.durationMs.toFixed(2)}ms`
            : `failed (${benchmarkRun.exitCode})`
        process.stdout.write(
          `  run ${iteration}/${args.iterations}: ${suffix}\n`,
        )
        if (benchmarkRun.exitCode !== 0) {
          printFailurePreview(benchmarkRun)
        }
      }

      results.runs.push({
        benchmarkId: projectBenchmark.id,
        command: benchmarkDefinition.command,
        commit: repoState.commit,
        cwd: project.cwd,
        directory: benchmarkTarget.directory,
        entryFile: benchmarkTarget.entryFile,
        iterations,
        loc,
        projectId: project.id,
        reason: undefined,
        repo: project.repo,
        status: iterations.every((iteration) => iteration.exitCode === 0)
          ? 'ok'
          : 'failed',
        summary: summarizeIterations(iterations),
        target: benchmarkDefinition.target,
      })
    }
  }

  const resultsPath =
    args.resultsFile ??
    path.join(resultsRoot, `benchmark-${timestampForFileName(new Date())}.json`)
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2))

  process.stdout.write('\nBenchmark environment:\n')
  printBenchmarkEnvironment(results.environment)
  process.stdout.write('\nBenchmark results:\n')
  printBenchmarkResults(results.runs)
  process.stdout.write(`\nSaved results to ${resultsPath}\n`)
}

function handleFatalError(error: unknown): void {
  if (error instanceof Error) {
    process.stderr.write(`${error.name}: ${error.message}\n`)
  } else {
    process.stderr.write(`${String(error)}\n`)
  }
  process.exitCode = 1
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    benchmarkIds: [],
    cloneDir: undefined,
    help: false,
    installConcurrency: 2,
    iterations: 5,
    list: false,
    listBenchmarks: false,
    listProjects: false,
    prepareConcurrency: 3,
    projects: [],
    resultsFile: undefined,
    skipInstall: false,
    sizes: [],
    topologies: [],
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === undefined || current === '--') {
      continue
    }

    if (current === '--help' || current === '-h') {
      parsed.help = true
      continue
    }

    if (current === '--list') {
      parsed.list = true
      continue
    }

    if (current === '--list-projects') {
      parsed.listProjects = true
      continue
    }

    if (current === '--list-benchmarks' || current === '--list-suites') {
      parsed.listBenchmarks = true
      continue
    }

    if (current === '--benchmark' || current === '--suite') {
      parsed.benchmarkIds.push(
        ...splitCsv(argv[++index]).map((benchmarkId) =>
          parseBenchmarkId(benchmarkId),
        ),
      )
      continue
    }

    if (current === '--project') {
      parsed.projects.push(...splitCsv(argv[++index]))
      continue
    }

    if (current === '--prepare-concurrency') {
      parsed.prepareConcurrency = parsePositiveIntegerOption(
        '--prepare-concurrency',
        argv[++index],
      )
      continue
    }

    if (current === '--install-concurrency') {
      parsed.installConcurrency = parsePositiveIntegerOption(
        '--install-concurrency',
        argv[++index],
      )
      continue
    }

    if (current === '--skip-install') {
      parsed.skipInstall = true
      continue
    }

    if (current === '--size') {
      parsed.sizes.push(
        ...splitCsv(argv[++index]).map((size) => parseBenchmarkSize(size)),
      )
      continue
    }

    if (current === '--topology') {
      parsed.topologies.push(
        ...splitCsv(argv[++index]).map((value) => parseTopology(value)),
      )
      continue
    }

    if (current === '--iterations') {
      const value = Number(argv[++index])
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('`--iterations` must be a positive integer.')
      }
      parsed.iterations = value
      continue
    }

    if (current === '--clone-dir') {
      parsed.cloneDir = argv[++index]
      continue
    }

    if (current === '--results-file') {
      parsed.resultsFile = argv[++index]
      continue
    }

    throw new Error(`Unknown argument: ${current}`)
  }

  return parsed
}

function getRequestedBenchmarkIds(requestedIds: BenchmarkId[]): BenchmarkId[] {
  const benchmarkIds =
    requestedIds.length === 0 ? getAllBenchmarkIds() : requestedIds

  return benchmarkIds.map(
    (benchmarkId) => getBenchmarkDefinition(benchmarkId).id,
  )
}

function getSelectedProjects(parsedArgs: ParsedArgs): BenchmarkProject[] {
  const requestedProjectIds =
    parsedArgs.projects.length === 0
      ? benchmarkProjects.map((project) => project.id)
      : parsedArgs.projects

  return requestedProjectIds
    .map((projectId) => {
      const project = projectById.get(projectId)
      if (project === undefined) {
        throw new Error(`Unknown project: ${projectId}`)
      }
      return project
    })
    .filter((project) =>
      parsedArgs.sizes.length === 0
        ? true
        : parsedArgs.sizes.includes(project.size),
    )
    .filter((project) =>
      parsedArgs.topologies.length === 0
        ? true
        : parsedArgs.topologies.includes(project.topology),
    )
}

function getProjectBenchmarks(
  project: BenchmarkProject,
  requestedBenchmarkIds: BenchmarkId[],
): ProjectBenchmark[] {
  const requestedSet = new Set(requestedBenchmarkIds)
  return project.benchmarks.filter((benchmark) =>
    requestedSet.has(benchmark.id),
  )
}

function getBenchmarkDefinition<K extends BenchmarkId>(
  benchmarkId: K,
): BenchmarkDefinition<K> {
  return {
    id: benchmarkId,
    ...benchmarkDefinitions[benchmarkId],
  }
}

async function ensureRepository(
  project: BenchmarkProject,
  repoDir: string,
): Promise<RepositoryState> {
  const gitDirectory = path.join(repoDir, '.git')
  try {
    if (!(await exists(gitDirectory))) {
      await runCommand('git', [
        'clone',
        '--filter=blob:none',
        '--depth',
        '1',
        '--single-branch',
        '--no-tags',
        '--branch',
        project.defaultBranch,
        project.cloneUrl,
        repoDir,
      ])
    } else {
      const status = await runCommand('git', [
        '-C',
        repoDir,
        'status',
        '--porcelain',
      ])
      if (status.stdout.trim().length > 0) {
        throw new Error(
          `Benchmark clone at ${repoDir} has local changes. Clean it up before rerunning.`,
        )
      }
      await runCommand('git', [
        '-C',
        repoDir,
        'pull',
        '--ff-only',
        '--no-tags',
        'origin',
        project.defaultBranch,
      ])
    }
  } catch (error) {
    process.stdout.write(`  clone failed for ${project.id}\n`)
    printPreparationErrorPreview(error)
    throw error
  }

  const commit = (
    await runCommand('git', ['-C', repoDir, 'rev-parse', 'HEAD'])
  ).stdout.trim()

  return { commit }
}

async function ensureDependenciesInstalled({
  project,
  repoDir,
}: {
  project: BenchmarkProject
  repoDir: string
}): Promise<void> {
  const installPlan = await detectInstallPlan(repoDir)
  process.stdout.write(
    `[install] ${project.id} (${installPlan.packageManager})\n`,
  )
  try {
    await runCommand(installPlan.packageManager, installPlan.args, {
      cwd: repoDir,
      maxBuffer: 20 * 1024 * 1024,
    })
  } catch (error) {
    if (shouldRetryYarnInstallWithoutLockfile(installPlan, error)) {
      process.stdout.write(
        `  retrying ${project.id} without lockfile enforcement\n`,
      )
      try {
        await runCommand('yarn', ['install'], {
          cwd: repoDir,
          maxBuffer: 20 * 1024 * 1024,
        })
        return
      } catch (retryError) {
        process.stdout.write(`  install retry failed for ${project.id}\n`)
        printPreparationErrorPreview(retryError)
        throw retryError
      }
    }

    process.stdout.write(`  install failed for ${project.id}\n`)
    printPreparationErrorPreview(error)
    throw error
  }
}

async function detectInstallPlan(repoDir: string): Promise<InstallPlan> {
  const packageManager = await detectPackageManager(repoDir)

  if (packageManager === 'pnpm') {
    return {
      args: ['install', '--frozen-lockfile'],
      packageManager,
    }
  }

  if (packageManager === 'bun') {
    return {
      args: ['install', '--frozen-lockfile'],
      packageManager,
    }
  }

  if (packageManager === 'yarn') {
    return {
      args: await getYarnInstallArgs(repoDir),
      packageManager,
    }
  }

  if (await exists(path.join(repoDir, 'package-lock.json'))) {
    return {
      args: ['ci'],
      packageManager,
    }
  }

  return {
    args: ['install'],
    packageManager,
  }
}

function shouldRetryYarnInstallWithoutLockfile(
  installPlan: InstallPlan,
  error: unknown,
): boolean {
  if (installPlan.packageManager !== 'yarn') {
    return false
  }

  if (
    !installPlan.args.includes('--immutable') &&
    !installPlan.args.includes('--frozen-lockfile')
  ) {
    return false
  }

  if (!(error instanceof CommandExecutionError)) {
    return false
  }

  const combinedPreview = [error.stderr, error.stdout].join('\n')
  return (
    combinedPreview.includes('YN0028') ||
    combinedPreview.includes(
      'The lockfile would have been modified by this install, which is explicitly forbidden.',
    )
  )
}

async function detectPackageManager(repoDir: string): Promise<PackageManager> {
  const packageManagerFromPackageJson = await readPackageManagerField(repoDir)
  if (packageManagerFromPackageJson !== undefined) {
    return packageManagerFromPackageJson
  }

  if (await exists(path.join(repoDir, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }

  if (
    (await exists(path.join(repoDir, 'bun.lockb'))) ||
    (await exists(path.join(repoDir, 'bun.lock')))
  ) {
    return 'bun'
  }

  if (await exists(path.join(repoDir, 'yarn.lock'))) {
    return 'yarn'
  }

  return 'npm'
}

async function readPackageManagerField(
  repoDir: string,
): Promise<PackageManager | undefined> {
  const packageJsonPath = path.join(repoDir, 'package.json')
  if (!(await exists(packageJsonPath))) {
    return undefined
  }

  const packageJson = JSON.parse(
    await fs.readFile(packageJsonPath, 'utf8'),
  ) as { packageManager?: string }
  const packageManagerField = packageJson.packageManager
  if (packageManagerField === undefined) {
    return undefined
  }

  if (packageManagerField.startsWith('pnpm@')) {
    return 'pnpm'
  }

  if (packageManagerField.startsWith('yarn@')) {
    return 'yarn'
  }

  if (packageManagerField.startsWith('bun@')) {
    return 'bun'
  }

  if (packageManagerField.startsWith('npm@')) {
    return 'npm'
  }

  return undefined
}

async function getYarnInstallArgs(repoDir: string): Promise<string[]> {
  const packageJsonPath = path.join(repoDir, 'package.json')
  if (await exists(packageJsonPath)) {
    const packageJson = JSON.parse(
      await fs.readFile(packageJsonPath, 'utf8'),
    ) as { packageManager?: string }
    const packageManagerField = packageJson.packageManager
    if (packageManagerField?.startsWith('yarn@')) {
      const version = Number(packageManagerField.split('@')[1]?.split('.')[0])
      if (!Number.isNaN(version) && version >= 2) {
        return ['install', '--immutable']
      }
    }
  }

  if (
    (await exists(path.join(repoDir, '.yarnrc.yml'))) ||
    (await exists(path.join(repoDir, '.yarn')))
  ) {
    return ['install', '--immutable']
  }

  return ['install', '--frozen-lockfile']
}

async function resolveBenchmarkTarget({
  benchmarkDefinition,
  project,
  projectBenchmark,
  projectCwd,
}: {
  benchmarkDefinition: BenchmarkDefinition
  project: BenchmarkProject
  projectBenchmark: ProjectBenchmark
  projectCwd: string
}): Promise<
  | {
      directory: string
      entryFile: undefined
      reason: undefined
      status: 'ready'
    }
  | {
      directory: undefined
      entryFile: string
      reason: undefined
      status: 'ready'
    }
  | {
      directory: undefined
      entryFile: undefined
      reason: undefined
      status: 'ready'
    }
  | {
      directory: string | undefined
      entryFile: string | undefined
      reason: string
      status: 'skipped'
    }
> {
  if (benchmarkDefinition.target === 'directory') {
    const directory = path.resolve(
      projectCwd,
      projectBenchmark.directory ?? '.',
    )
    if (!(await exists(directory))) {
      return {
        directory: undefined,
        entryFile: undefined,
        reason: `Directory does not exist: ${projectBenchmark.directory ?? '.'}`,
        status: 'skipped',
      }
    }

    if (!(await hasValidPackageName(directory))) {
      return {
        directory: undefined,
        entryFile: undefined,
        reason: 'Package manifest is missing a valid name.',
        status: 'skipped',
      }
    }

    return {
      directory,
      entryFile: undefined,
      reason: undefined,
      status: 'ready',
    }
  }

  if (benchmarkDefinition.target === 'nextjs') {
    return {
      directory: undefined,
      entryFile: undefined,
      reason: undefined,
      status: 'ready',
    }
  }

  const entryFile = await discoverEntryFile(projectCwd, project)
  if (entryFile === undefined) {
    return {
      directory: undefined,
      entryFile: undefined,
      reason: 'No entry file discovered.',
      status: 'skipped',
    }
  }

  return {
    directory: undefined,
    entryFile,
    reason: undefined,
    status: 'ready',
  }
}

async function discoverEntryFile(
  projectCwd: string,
  project: BenchmarkProject,
): Promise<string | undefined> {
  for (const candidate of [
    ...project.preferredEntries,
    ...defaultEntryCandidates,
  ]) {
    const absoluteCandidate = path.join(projectCwd, candidate)
    if (await exists(absoluteCandidate)) {
      return candidate
    }
  }

  const discovered: string[] = []
  await walkFiles(projectCwd, projectCwd, discovered)

  const preferredNames = [
    'page.tsx',
    'page.ts',
    'page.jsx',
    'page.js',
    'index.tsx',
    'index.ts',
    'index.jsx',
    'index.js',
    'main.tsx',
    'main.ts',
    'main.jsx',
    'main.js',
  ]
  const preferredNameOrder = new Map(
    preferredNames.map((name, index) => [name, index] as const),
  )

  const matched = discovered
    .filter((relativePath) =>
      preferredNameOrder.has(path.basename(relativePath)),
    )
    .sort((left, right) => {
      const leftOrder =
        preferredNameOrder.get(path.basename(left)) ?? Number.MAX_SAFE_INTEGER
      const rightOrder =
        preferredNameOrder.get(path.basename(right)) ?? Number.MAX_SAFE_INTEGER
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }

      const leftDepth = left.split(path.sep).length
      const rightDepth = right.split(path.sep).length
      if (leftDepth !== rightDepth) {
        return leftDepth - rightDepth
      }

      return left.localeCompare(right)
    })

  return matched[0]
}

async function walkFiles(
  rootDir: string,
  currentDir: string,
  collected: string[],
): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  for (const entry of entries) {
    if (shouldIgnoreEntry(entry.name)) {
      continue
    }

    const absolutePath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      await walkFiles(rootDir, absolutePath, collected)
      continue
    }

    if (entry.isFile()) {
      collected.push(path.relative(rootDir, absolutePath))
    }
  }
}

function shouldIgnoreEntry(name: string): boolean {
  return [
    '.git',
    '.next',
    '.turbo',
    'dist',
    'build',
    'coverage',
    'node_modules',
    'storybook-static',
  ].includes(name)
}

async function runForesthouseBenchmark({
  benchmarkDefinition,
  directory,
  entryFile,
  foresthouseCliPath,
  projectCwd,
}: BenchmarkInvocation): Promise<BenchmarkIteration> {
  const commandArgs = [foresthouseCliPath, benchmarkDefinition.command]

  if (benchmarkDefinition.target === 'nextjs') {
    commandArgs.push('--nextjs')
  }

  if (benchmarkDefinition.target === 'entry' && entryFile !== undefined) {
    commandArgs.push(entryFile)
  }

  if (benchmarkDefinition.target === 'directory' && directory !== undefined) {
    commandArgs.push(directory)
  }

  if (benchmarkDefinition.command === 'deps') {
    commandArgs.push(...benchmarkDefinition.extraArgs)
  } else {
    commandArgs.push(...benchmarkDefinition.extraArgs, '--cwd', projectCwd)
  }

  const startedAt = process.hrtime.bigint()
  const result = await runCommand('node', commandArgs, {
    allowFailure: true,
    maxBuffer: 10 * 1024 * 1024,
  })
  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000

  return {
    args: ['node', ...commandArgs],
    durationMs,
    exitCode: result.exitCode,
    stderr: result.stderr,
    stderrBytes: Buffer.byteLength(result.stderr, 'utf8'),
    stdout: result.stdout,
    stdoutBytes: Buffer.byteLength(result.stdout, 'utf8'),
  }
}

function summarizeIterations(
  iterations: BenchmarkIteration[],
): BenchmarkSummary {
  const durations = iterations
    .filter((iteration) => iteration.exitCode === 0)
    .map((iteration) => iteration.durationMs)
    .sort((left, right) => left - right)

  if (durations.length === 0) {
    return {
      avgMs: undefined,
      maxMs: undefined,
      medianMs: undefined,
      minMs: undefined,
      p90Ms: undefined,
      p95Ms: undefined,
      p99Ms: undefined,
      successfulRuns: 0,
    }
  }

  const total = durations.reduce((sum, value) => sum + value, 0)

  return {
    avgMs: total / durations.length,
    maxMs: durations[durations.length - 1],
    medianMs: percentile(durations, 0.5),
    minMs: durations[0],
    p90Ms: percentile(durations, 0.9),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    successfulRuns: durations.length,
  }
}

function percentile(sortedValues: number[], percentileValue: number): number {
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1),
  )
  return sortedValues[index] ?? sortedValues[sortedValues.length - 1] ?? 0
}

async function mapWithConcurrency<TInput, TOutput>(
  values: TInput[],
  concurrency: number,
  iteratee: (value: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const normalizedConcurrency = Math.max(1, concurrency)
  const results = new Array<TOutput>(values.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= values.length) {
        return
      }

      results[currentIndex] = await iteratee(
        values[currentIndex] as TInput,
        currentIndex,
      )
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(normalizedConcurrency, values.length) }, () =>
      worker(),
    ),
  )

  return results
}

function printFailurePreview(iteration: BenchmarkIteration): void {
  const stderrOutput = iteration.stderr.trim()
  if (stderrOutput.length > 0) {
    process.stdout.write('    stderr:\n')
    stderrOutput.split('\n').forEach((line) => {
      process.stdout.write(`      ${line}\n`)
    })
    return
  }

  const stdoutPreview = toPreviewLines(iteration.stdout).filter(Boolean)
  if (stdoutPreview.length > 0) {
    process.stdout.write('    stdout preview:\n')
    stdoutPreview.forEach((line) => {
      process.stdout.write(`      ${line}\n`)
    })
    return
  }

  process.stdout.write('    no stderr/stdout preview captured\n')
}

function printPreparationErrorPreview(error: unknown): void {
  if (error instanceof CommandExecutionError) {
    const stderrOutput = error.stderr.trim()
    if (stderrOutput.length > 0) {
      process.stdout.write('    stderr:\n')
      stderrOutput.split('\n').forEach((line) => {
        process.stdout.write(`      ${line}\n`)
      })
      return
    }

    const stdoutPreview = toPreviewLines(error.stdout).filter(Boolean)
    if (stdoutPreview.length > 0) {
      process.stdout.write('    stdout preview:\n')
      stdoutPreview.forEach((line) => {
        process.stdout.write(`      ${line}\n`)
      })
      return
    }
  }

  if (error instanceof Error && error.message.length > 0) {
    process.stdout.write(`    ${error.message}\n`)
    return
  }

  process.stdout.write('    no stderr/stdout preview captured\n')
}

function splitCsv(value: string | undefined): string[] {
  if (value === undefined) {
    throw new Error('Expected a value after the option.')
  }

  return value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
}

async function ensureFileExists(
  filePath: string,
  message: string,
): Promise<void> {
  if (!(await exists(filePath))) {
    throw new Error(message)
  }
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function hasValidPackageName(directory: string): Promise<boolean> {
  const packageJsonPath = path.join(directory, 'package.json')
  if (!(await exists(packageJsonPath))) {
    return false
  }

  const packageJson = JSON.parse(
    await fs.readFile(packageJsonPath, 'utf8'),
  ) as { name?: unknown }

  return (
    typeof packageJson.name === 'string' && packageJson.name.trim().length > 0
  )
}

async function countProjectSourceLines(projectCwd: string): Promise<number> {
  if (!(await exists(projectCwd))) {
    return 0
  }

  const discoveredFiles: string[] = []
  await walkFiles(projectCwd, projectCwd, discoveredFiles)

  let totalLines = 0
  for (const relativePath of discoveredFiles) {
    if (!isSourceFileForLoc(relativePath)) {
      continue
    }

    const absolutePath = path.join(projectCwd, relativePath)
    const content = await fs.readFile(absolutePath, 'utf8')
    totalLines += countLines(content)
  }

  return totalLines
}

function isSourceFileForLoc(filePath: string): boolean {
  return [
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.mjs',
    '.cjs',
    '.mts',
    '.cts',
  ].includes(path.extname(filePath))
}

function countLines(content: string): number {
  if (content.length === 0) {
    return 0
  }

  return content.split('\n').length
}

function timestampForFileName(date: Date): string {
  return date.toISOString().replaceAll(':', '-')
}

function toPreviewLines(output: string): string[] {
  const trimmed = output.trim()
  if (trimmed.length === 0) {
    return []
  }

  return trimmed.split('\n').slice(-10)
}

function parseBenchmarkSize(value: string): BenchmarkSize {
  if (value === 'large' || value === 'medium' || value === 'small') {
    return value
  }

  throw new Error(`Unknown size: ${value}`)
}

function parsePositiveIntegerOption(
  optionName: string,
  value: string | undefined,
): number {
  const parsedValue = Number(value)
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`\`${optionName}\` must be a positive integer.`)
  }

  return parsedValue
}

function parseBenchmarkId(value: string): BenchmarkId {
  if (value in benchmarkDefinitions) {
    return value as BenchmarkId
  }

  throw new Error(`Unknown benchmark: ${value}`)
}

function getAllBenchmarkIds(): BenchmarkId[] {
  return Object.keys(benchmarkDefinitions) as BenchmarkId[]
}

function parseTopology(value: string): BenchmarkTopology {
  if (value === 'monorepo' || value === 'single') {
    return value
  }

  throw new Error(`Unknown topology: ${value}`)
}

function printProjects(): void {
  process.stdout.write('Projects:\n')
  benchmarkProjects.forEach((project) => {
    const benchmarkIds = project.benchmarks.map((benchmark) => benchmark.id)
    process.stdout.write(
      `  ${project.id} | ${project.size} ${project.topology} | ${project.repo} | ${project.stars} stars | cwd=${project.cwd}\n`,
    )
    process.stdout.write(`    benchmarks: ${benchmarkIds.join(', ')}\n`)
  })
}

function printBenchmarks(): void {
  process.stdout.write('Benchmark matrix:\n')
  printBenchmarkMatrix(benchmarkProjects, getAllBenchmarkIds())
}

function printBenchmarkEnvironment(environment: BenchmarkEnvironment): void {
  process.stdout.write(
    renderTable(
      ['Metric', 'Value'],
      [
        ['Platform', environment.platform],
        ['Node', environment.nodeVersion],
        ['CPU', environment.cpuModel],
        ['Cores', String(environment.cpuCores)],
        ['Memory', environment.totalMemoryGb],
      ],
    ),
  )
}

function printBenchmarkResults(runs: BenchmarkRunRecord[]): void {
  const commandOrder = ['deps', 'import', 'react'] as const

  for (const command of commandOrder) {
    const rows = runs
      .filter((run) => run.command === command)
      .map((run) => {
        const definition = getBenchmarkDefinition(run.benchmarkId)
        return [
          formatTarget(definition),
          formatOptions(definition.extraArgs),
          run.projectId,
          run.loc.toLocaleString('en-US'),
          run.status,
          formatDuration(run.summary?.medianMs),
          formatDuration(run.summary?.p95Ms),
          run.reason ?? '',
        ]
      })

    if (rows.length === 0) {
      continue
    }

    process.stdout.write(`\n${command}\n`)
    process.stdout.write(
      renderTable(
        [
          'Target',
          'Options',
          'Project',
          'LOC',
          'Status',
          'Median',
          'P95',
          'Note',
        ],
        rows,
      ),
    )
  }
}

function printBenchmarkMatrix(
  projects: BenchmarkProject[],
  benchmarkIds: BenchmarkId[],
): void {
  const commandOrder = ['deps', 'import', 'react'] as const

  for (const command of commandOrder) {
    const rows = benchmarkIds
      .map((benchmarkId) => {
        const definition = getBenchmarkDefinition(benchmarkId)
        if (definition.command !== command) {
          return undefined
        }

        const supportedProjects = projects
          .filter((project) =>
            project.benchmarks.some(
              (benchmark) => benchmark.id === benchmarkId,
            ),
          )
          .map((project) => project.id)

        if (supportedProjects.length === 0) {
          return undefined
        }

        return [
          formatTarget(definition),
          formatOptions(definition.extraArgs),
          benchmarkId,
          supportedProjects.join(', '),
        ]
      })
      .filter(
        (row): row is [string, string, string, string] => row !== undefined,
      )

    if (rows.length === 0) {
      continue
    }

    process.stdout.write(`\n${command}\n`)
    process.stdout.write(
      renderTable(['Target', 'Options', 'Benchmark ID', 'Projects'], rows),
    )
  }
}

function formatOptions(extraArgs: string[]): string {
  return extraArgs.length === 0 ? '(none)' : extraArgs.join(' ')
}

function formatDuration(value: number | undefined): string {
  return value === undefined ? '-' : `${value.toFixed(2)}ms`
}

function formatTarget(definition: BenchmarkDefinition): string {
  if (definition.target === 'entry') {
    return 'entry'
  }

  if (definition.target === 'nextjs') {
    return 'nextjs'
  }

  return 'directory'
}

function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]?.length ?? 0)),
  )
  const separator = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+\n`
  const renderRow = (cells: string[]) =>
    `| ${cells
      .map((cell, index) => cell.padEnd(widths[index] ?? cell.length))
      .join(' | ')} |\n`

  return [
    separator,
    renderRow(headers),
    separator,
    ...rows.map((row) => renderRow(row)),
    separator,
  ].join('')
}

function collectBenchmarkEnvironment(): BenchmarkEnvironment {
  const cpus = os.cpus()
  const firstCpu = cpus[0]

  return {
    cpuCores: cpus.length,
    cpuModel: firstCpu?.model ?? 'unknown',
    nodeVersion: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    totalMemoryGb: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
  }
}

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: tsx bench/run.ts [options]',
      '',
      'Options:',
      '  --list                      Print both projects and benchmarks.',
      '  --list-projects             Print the curated project catalog.',
      '  --list-benchmarks          Print the benchmark catalog.',
      '  --list-suites              Alias for --list-benchmarks.',
      '  --benchmark <ids>          Comma-separated benchmark ids to run.',
      '  --suite <ids>              Alias for --benchmark.',
      '  --project <ids>            Comma-separated project ids to run.',
      '  --prepare-concurrency <n>  Clone/update repositories with up to n concurrent workers.',
      '  --install-concurrency <n>  Install dependencies with up to n concurrent workers.',
      '  --skip-install             Skip dependency installation for cloned repositories.',
      '  --size <sizes>             Filter projects by size: large,medium,small.',
      '  --topology <values>        Filter by topology: monorepo,single.',
      '  --iterations <count>       Number of benchmark repetitions per project/benchmark.',
      '  --clone-dir <path>         Override the clone cache directory.',
      '  --results-file <path>      Override the JSON results output path.',
      '  --help                     Show this message.',
    ].join('\n'),
  )
}

function runCommand(
  command: string,
  commandArgs: string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  const { allowFailure = false, cwd, maxBuffer = 5 * 1024 * 1024 } = options

  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
      if (stdout.length > maxBuffer) {
        child.kill('SIGTERM')
      }
    })

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
      if (stderr.length > maxBuffer) {
        child.kill('SIGTERM')
      }
    })

    child.on('error', reject)
    child.on('close', (exitCode) => {
      const result: CommandResult = {
        exitCode: exitCode ?? 1,
        stderr,
        stdout,
      }

      if (!allowFailure && result.exitCode !== 0) {
        reject(new CommandExecutionError(command, commandArgs, result))
        return
      }

      resolve(result)
    })
  })
}
