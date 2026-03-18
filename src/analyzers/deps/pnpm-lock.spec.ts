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

describe('loadPnpmLockImporterResolutions', () => {
  it('loads importer resolutions from pnpm-lock.yaml', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'foresthouse-pnpm-'),
    )
    temporaryDirectories.push(directory)

    fs.writeFileSync(
      path.join(directory, 'pnpm-lock.yaml'),
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
})
