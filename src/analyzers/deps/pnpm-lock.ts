import fs from 'node:fs'
import path from 'node:path'

export interface PnpmLockDependencyResolution {
  readonly specifier?: string
  readonly version?: string
  readonly peerSuffix?: string
}

export type PnpmLockImporterResolutions = ReadonlyMap<
  string,
  ReadonlyMap<string, PnpmLockDependencyResolution>
>

const PNPM_LOCKFILE = 'pnpm-lock.yaml'
const DEPENDENCY_SECTIONS = new Set(['dependencies', 'optionalDependencies'])

export function loadPnpmLockImporterResolutions(
  repositoryRoot: string,
): PnpmLockImporterResolutions | undefined {
  const lockfilePath = path.join(repositoryRoot, PNPM_LOCKFILE)

  if (!fs.existsSync(lockfilePath)) {
    return undefined
  }

  return parsePnpmLockImporterResolutions(fs.readFileSync(lockfilePath, 'utf8'))
}

function parsePnpmLockImporterResolutions(
  source: string,
): PnpmLockImporterResolutions {
  const importers = new Map<string, Map<string, PnpmLockDependencyResolution>>()
  const lines = source.split(/\r?\n/u)
  let inImporters = false
  let currentImporter: string | undefined
  let currentSection: string | undefined
  let currentDependencyName: string | undefined

  lines.forEach((line) => {
    const trimmedLine = line.trim()
    if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
      return
    }

    const indentation = line.length - line.trimStart().length

    if (indentation === 0) {
      if (trimmedLine === 'importers:') {
        inImporters = true
        currentImporter = undefined
        currentSection = undefined
        currentDependencyName = undefined
        return
      }

      inImporters = false
      return
    }

    if (!inImporters) {
      return
    }

    if (indentation === 2 && trimmedLine.endsWith(':')) {
      currentImporter = parseYamlScalar(trimmedLine.slice(0, -1))
      currentSection = undefined
      currentDependencyName = undefined

      if (!importers.has(currentImporter)) {
        importers.set(currentImporter, new Map())
      }
      return
    }

    if (currentImporter === undefined) {
      return
    }

    if (indentation === 4 && trimmedLine.endsWith(':')) {
      const sectionName = parseYamlScalar(trimmedLine.slice(0, -1))
      currentSection = DEPENDENCY_SECTIONS.has(sectionName)
        ? sectionName
        : undefined
      currentDependencyName = undefined
      return
    }

    if (currentSection === undefined) {
      return
    }

    if (indentation === 6) {
      if (trimmedLine.endsWith(':')) {
        currentDependencyName = parseYamlScalar(trimmedLine.slice(0, -1))
        upsertDependency(importers, currentImporter, currentDependencyName, {})
        return
      }

      const pair = splitYamlKeyValue(trimmedLine)
      if (pair === undefined) {
        return
      }

      currentDependencyName = undefined
      upsertDependency(importers, currentImporter, parseYamlScalar(pair.key), {
        ...parsePnpmVersion(parseYamlScalar(pair.value)),
      })
      return
    }

    if (indentation === 8 && currentDependencyName !== undefined) {
      const pair = splitYamlKeyValue(trimmedLine)
      if (pair === undefined) {
        return
      }

      if (pair.key === 'specifier') {
        upsertDependency(importers, currentImporter, currentDependencyName, {
          specifier: parseYamlScalar(pair.value),
        })
        return
      }

      if (pair.key === 'version') {
        upsertDependency(importers, currentImporter, currentDependencyName, {
          ...parsePnpmVersion(parseYamlScalar(pair.value)),
        })
      }
    }
  })

  return importers
}

function upsertDependency(
  importers: Map<string, Map<string, PnpmLockDependencyResolution>>,
  importerPath: string,
  dependencyName: string,
  nextValue: PnpmLockDependencyResolution,
): void {
  const importer = importers.get(importerPath)
  if (importer === undefined) {
    return
  }

  importer.set(dependencyName, {
    ...importer.get(dependencyName),
    ...nextValue,
  })
}

function splitYamlKeyValue(
  line: string,
): { readonly key: string; readonly value: string } | undefined {
  const separatorIndex = line.indexOf(':')

  if (separatorIndex <= 0) {
    return undefined
  }

  return {
    key: line.slice(0, separatorIndex).trim(),
    value: line.slice(separatorIndex + 1).trim(),
  }
}

function parseYamlScalar(value: string): string {
  if (value.length >= 2) {
    const firstCharacter = value[0]
    const lastCharacter = value[value.length - 1]

    if (
      (firstCharacter === '"' && lastCharacter === '"') ||
      (firstCharacter === "'" && lastCharacter === "'")
    ) {
      return value.slice(1, -1)
    }
  }

  return value
}

function parsePnpmVersion(
  value: string,
): Pick<PnpmLockDependencyResolution, 'version' | 'peerSuffix'> {
  const firstParenthesisIndex = value.indexOf('(')

  if (firstParenthesisIndex < 0) {
    return {
      version: value,
    }
  }

  return {
    version: value.slice(0, firstParenthesisIndex),
    peerSuffix: value.slice(firstParenthesisIndex),
  }
}
