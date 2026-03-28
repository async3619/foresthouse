import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  discoverNextJsPageEntries,
  resolveReactEntryFiles,
} from './react-entry-files.js'

const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true })
  })
})

describe('react entry file helpers', () => {
  it('returns an explicit entry file without attempting Next.js discovery', () => {
    expect(
      resolveReactEntryFiles({
        command: 'react',
        entryFile: 'src/main.tsx',
        diff: undefined,
        cwd: '/repo',
        configPath: undefined,
        expandWorkspaces: true,
        projectOnly: false,
        json: false,
        filter: 'all',
        includeBuiltins: false,
        nextjs: true,
      }),
    ).toEqual(['src/main.tsx'])
  })

  it('requires either an explicit entry file or --nextjs', () => {
    expect(() =>
      resolveReactEntryFiles({
        command: 'react',
        entryFile: undefined,
        diff: undefined,
        cwd: '/repo',
        configPath: undefined,
        expandWorkspaces: true,
        projectOnly: false,
        json: false,
        filter: 'all',
        includeBuiltins: false,
        nextjs: false,
      }),
    ).toThrow(
      'Missing React entry file. Use `foresthouse react <entry-file>` or `foresthouse react --nextjs`.',
    )
  })

  it('discovers Next.js page entries while skipping api routes, underscores, and declarations', () => {
    const cwd = createTemporaryProject()

    writeFile(cwd, 'pages/index.tsx')
    writeFile(cwd, 'pages/blog/[slug].tsx')
    writeFile(cwd, 'pages/_app.tsx')
    writeFile(cwd, 'pages/api/health.ts')
    writeFile(cwd, 'app/dashboard/page.tsx')
    writeFile(cwd, 'app/dashboard/loading.tsx')
    writeFile(cwd, 'src/pages/profile.jsx')
    writeFile(cwd, 'src/app/settings/page.mts')
    writeFile(cwd, 'src/app/settings/page.d.ts')

    expect(discoverNextJsPageEntries(cwd)).toEqual([
      'app/dashboard/page.tsx',
      'pages/blog/[slug].tsx',
      'pages/index.tsx',
      'src/app/settings/page.mts',
      'src/pages/profile.jsx',
    ])
  })
})

function createTemporaryProject(): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'foresthouse-react-entry-files-'),
  )
  temporaryDirectories.push(directory)
  return directory
}

function writeFile(cwd: string, relativePath: string): void {
  const filePath = path.join(cwd, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, 'export {}\n')
}
