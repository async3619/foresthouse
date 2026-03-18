import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { resolveExistingPath } from './entry.js'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true })
  })
})

describe('resolveExistingPath', () => {
  it('resolves existing source entry files', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'foresthouse-entry-path-'),
    )
    temporaryDirectories.push(directory)

    fs.writeFileSync(path.join(directory, 'main.ts'), 'export {}\n')

    expect(resolveExistingPath(directory, './main.ts')).toBe(
      path.join(directory, 'main.ts'),
    )
  })
})
