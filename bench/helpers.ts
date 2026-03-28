import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const temporaryDirectories: string[] = []

let cleanupRegistered = false
const GIT_EXEC_MAX_BUFFER = 64 * 1024 * 1024

export function createGitRepository(
  prefix: string,
  commits: readonly {
    readonly message: string
    readonly files: Readonly<Record<string, string>>
  }[],
): string {
  registerCleanup()

  const repositoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  temporaryDirectories.push(repositoryRoot)

  runGit(repositoryRoot, ['init', '--initial-branch=main'])
  runGit(repositoryRoot, ['config', 'user.name', 'Foresthouse Benchmarks'])
  runGit(repositoryRoot, ['config', 'user.email', 'benchmarks@example.com'])

  commits.forEach((commit) => {
    replaceRepositoryFiles(repositoryRoot, commit.files)
    runGit(repositoryRoot, ['add', '-A'])
    runGit(repositoryRoot, ['commit', '-m', commit.message])
  })

  return repositoryRoot
}

function replaceRepositoryFiles(
  repositoryRoot: string,
  files: Readonly<Record<string, string>>,
): void {
  fs.readdirSync(repositoryRoot, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === '.git') {
      return
    }

    fs.rmSync(path.join(repositoryRoot, entry.name), {
      recursive: true,
      force: true,
    })
  })

  Object.entries(files).forEach(([relativePath, fileContent]) => {
    const absolutePath = path.join(repositoryRoot, relativePath)
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, fileContent)
  })
}

function runGit(repositoryRoot: string, args: readonly string[]): string {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: GIT_EXEC_MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function registerCleanup(): void {
  if (cleanupRegistered) {
    return
  }

  cleanupRegistered = true

  process.on('exit', () => {
    temporaryDirectories.splice(0).forEach((directory) => {
      fs.rmSync(directory, { recursive: true, force: true })
    })
  })
}
