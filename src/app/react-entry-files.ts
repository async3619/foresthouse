import fs from 'node:fs'
import path from 'node:path'
import { isSourceCodeFile } from '../utils/is-source-code-file.js'
import type { ReactCliOptions } from './args.js'

const NEXT_JS_ENTRY_ROOTS = [
  'pages',
  'app',
  path.join('src', 'pages'),
  path.join('src', 'app'),
]

export function resolveReactEntryFiles(options: ReactCliOptions): string[] {
  if (options.entryFile !== undefined) {
    return [options.entryFile]
  }

  if (!options.nextjs) {
    throw new Error(
      'Missing React entry file. Use `foresthouse react <entry-file>` or `foresthouse react --nextjs`.',
    )
  }

  return discoverNextJsPageEntries(options.cwd)
}

export function discoverNextJsPageEntries(cwd?: string): string[] {
  const effectiveCwd = path.resolve(cwd ?? process.cwd())
  const entries = new Set<string>()

  collectPagesRouterEntries(
    path.join(effectiveCwd, 'pages'),
    effectiveCwd,
    entries,
  )
  collectAppRouterEntries(path.join(effectiveCwd, 'app'), effectiveCwd, entries)
  collectPagesRouterEntries(
    path.join(effectiveCwd, 'src', 'pages'),
    effectiveCwd,
    entries,
  )
  collectAppRouterEntries(
    path.join(effectiveCwd, 'src', 'app'),
    effectiveCwd,
    entries,
  )

  const resolvedEntries = [...entries].sort()
  if (resolvedEntries.length > 0) {
    return resolvedEntries
  }

  const searchedRoots = NEXT_JS_ENTRY_ROOTS.map((root) => `\`${root}/\``).join(
    ', ',
  )
  throw new Error(
    `No Next.js page entries found. Searched ${searchedRoots} relative to ${effectiveCwd}.`,
  )
}

function collectPagesRouterEntries(
  rootDirectory: string,
  cwd: string,
  entries: Set<string>,
): void {
  walkDirectory(rootDirectory, (filePath, relativePath) => {
    if (!isSourceCodeFile(filePath) || filePath.endsWith('.d.ts')) {
      return
    }

    const segments = relativePath.split(path.sep)
    if (segments[0] === 'api') {
      return
    }

    const baseName = path.basename(filePath)
    if (baseName.startsWith('_')) {
      return
    }

    entries.add(path.relative(cwd, filePath))
  })
}

function collectAppRouterEntries(
  rootDirectory: string,
  cwd: string,
  entries: Set<string>,
): void {
  walkDirectory(rootDirectory, (filePath) => {
    if (!isSourceCodeFile(filePath) || filePath.endsWith('.d.ts')) {
      return
    }

    const extension = path.extname(filePath)
    const baseName = path.basename(filePath, extension)
    if (baseName !== 'page') {
      return
    }

    entries.add(path.relative(cwd, filePath))
  })
}

function walkDirectory(
  rootDirectory: string,
  visitor: (filePath: string, relativePath: string) => void,
): void {
  if (!fs.existsSync(rootDirectory)) {
    return
  }

  const stack = [rootDirectory]

  while (stack.length > 0) {
    const directory = stack.pop()
    if (directory === undefined) {
      continue
    }

    const directoryEntries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))

    for (let index = directoryEntries.length - 1; index >= 0; index -= 1) {
      const entry = directoryEntries[index]
      if (entry === undefined) {
        continue
      }

      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        stack.push(entryPath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      visitor(entryPath, path.relative(rootDirectory, entryPath))
    }
  }
}
