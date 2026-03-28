import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { loadPnpmLockImporterResolutions } from './pnpm-lock.js'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true })
  })
})

function createTemporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'foresthouse-pnpm-'))
  temporaryDirectories.push(directory)
  return directory
}

function writeLockfile(directory: string, content: string): void {
  fs.writeFileSync(path.join(directory, 'pnpm-lock.yaml'), content)
}

describe('loadPnpmLockImporterResolutions', () => {
  it('returns undefined when no pnpm-lock.yaml exists', () => {
    const dir = createTemporaryDirectory()

    const result = loadPnpmLockImporterResolutions(dir)

    expect(result).toBeUndefined()
  })

  it('loads importer resolutions from pnpm-lock.yaml', () => {
    const directory = createTemporaryDirectory()

    writeLockfile(
      directory,
      [
        'importers:',
        '  .:',
        '    dependencies:',
        '      react:',
        '        specifier: ^19.1.1',
        '        version: 19.1.1',
      ].join('\n'),
    )

    const importers = loadPnpmLockImporterResolutions(directory)

    expect(importers?.get('.')?.get('react')).toEqual({
      specifier: '^19.1.1',
      version: '19.1.1',
    })
  })

  it('parses simple lockfile with one importer and dependencies', () => {
    const dir = createTemporaryDirectory()

    writeLockfile(
      dir,
      [
        "lockfileVersion: '9.0'",
        '',
        'importers:',
        '  .:',
        '    dependencies:',
        '      react:',
        '        specifier: ^18.0.0',
        '        version: 18.2.0',
        '      lodash:',
        '        specifier: ^4.17.21',
        '        version: 4.17.21',
      ].join('\n'),
    )

    const importers = loadPnpmLockImporterResolutions(dir)

    if (!importers) throw new Error('Expected importers to be defined')
    const rootImporter = importers.get('.')
    if (!rootImporter) throw new Error('Expected root importer to be defined')

    expect(rootImporter.get('react')).toEqual({
      specifier: '^18.0.0',
      version: '18.2.0',
    })
    expect(rootImporter.get('lodash')).toEqual({
      specifier: '^4.17.21',
      version: '4.17.21',
    })
  })

  it('handles quoted importer paths', () => {
    const dir = createTemporaryDirectory()

    writeLockfile(
      dir,
      [
        'importers:',
        "  '.':",
        '    dependencies:',
        '      react:',
        '        specifier: ^18.0.0',
        '        version: 18.2.0',
      ].join('\n'),
    )

    const importers = loadPnpmLockImporterResolutions(dir)

    if (!importers) throw new Error('Expected importers to be defined')
    expect(importers.get('.')?.get('react')).toEqual({
      specifier: '^18.0.0',
      version: '18.2.0',
    })
  })

  it('parses version with peer suffix', () => {
    const dir = createTemporaryDirectory()

    writeLockfile(
      dir,
      [
        'importers:',
        '  .:',
        '    dependencies:',
        '      react-dom:',
        '        specifier: ^18.0.0',
        '        version: 18.2.0(react@18.2.0)',
      ].join('\n'),
    )

    const importers = loadPnpmLockImporterResolutions(dir)

    if (!importers) throw new Error('Expected importers to be defined')
    const dep = importers.get('.')?.get('react-dom')
    expect(dep?.version).toBe('18.2.0')
    expect(dep?.peerSuffix).toBe('(react@18.2.0)')
  })

  it('handles optionalDependencies section', () => {
    const dir = createTemporaryDirectory()

    writeLockfile(
      dir,
      [
        "lockfileVersion: '9.0'",
        '',
        'importers:',
        '  .:',
        '    dependencies:',
        '      react:',
        '        specifier: ^18.0.0',
        '        version: 18.2.0',
        '    optionalDependencies:',
        '      fsevents:',
        '        specifier: ^2.3.0',
        '        version: 2.3.3',
      ].join('\n'),
    )

    const importers = loadPnpmLockImporterResolutions(dir)

    if (!importers) throw new Error('Expected importers to be defined')
    const rootImporter = importers.get('.')
    if (!rootImporter) throw new Error('Expected root importer')

    expect(rootImporter.get('react')).toEqual({
      specifier: '^18.0.0',
      version: '18.2.0',
    })
    expect(rootImporter.get('fsevents')).toEqual({
      specifier: '^2.3.0',
      version: '2.3.3',
    })
  })

  it('skips devDependencies section', () => {
    const dir = createTemporaryDirectory()

    writeLockfile(
      dir,
      [
        'importers:',
        '  .:',
        '    dependencies:',
        '      react:',
        '        specifier: ^18.0.0',
        '        version: 18.2.0',
        '    devDependencies:',
        '      typescript:',
        '        specifier: ^5.0.0',
        '        version: 5.3.3',
      ].join('\n'),
    )

    const importers = loadPnpmLockImporterResolutions(dir)

    if (!importers) throw new Error('Expected importers to be defined')
    const rootImporter = importers.get('.')
    if (!rootImporter) throw new Error('Expected root importer')

    expect(rootImporter.get('react')).toBeDefined()
    expect(rootImporter.has('typescript')).toBe(false)
  })

  it('handles nested dependency properties (specifier + version on separate lines)', () => {
    const dir = createTemporaryDirectory()

    writeLockfile(
      dir,
      [
        'importers:',
        '  .:',
        '    dependencies:',
        '      axios:',
        '        specifier: ^1.6.0',
        '        version: 1.6.7',
      ].join('\n'),
    )

    const importers = loadPnpmLockImporterResolutions(dir)

    if (!importers) throw new Error('Expected importers to be defined')
    const dep = importers.get('.')?.get('axios')
    expect(dep).toEqual({
      specifier: '^1.6.0',
      version: '1.6.7',
    })
  })

  it('handles empty lockfile or lockfile with no importers section', () => {
    const dir = createTemporaryDirectory()

    writeLockfile(dir, "lockfileVersion: '9.0'\n")

    const importers = loadPnpmLockImporterResolutions(dir)

    if (!importers) throw new Error('Expected importers to be defined')
    expect(importers.size).toBe(0)
  })

  it('handles multiple importers', () => {
    const dir = createTemporaryDirectory()

    writeLockfile(
      dir,
      [
        'importers:',
        '  .:',
        '    dependencies:',
        '      react:',
        '        specifier: ^18.0.0',
        '        version: 18.2.0',
        '  packages/ui:',
        '    dependencies:',
        '      lodash:',
        '        specifier: ^4.17.21',
        '        version: 4.17.21',
      ].join('\n'),
    )

    const importers = loadPnpmLockImporterResolutions(dir)

    if (!importers) throw new Error('Expected importers to be defined')
    expect(importers.size).toBe(2)
    expect(importers.get('.')?.get('react')?.version).toBe('18.2.0')
    expect(importers.get('packages/ui')?.get('lodash')?.version).toBe('4.17.21')
  })
})
