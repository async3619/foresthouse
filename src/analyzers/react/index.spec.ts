import fs from 'node:fs'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { analyzeDependenciesForEntries } from '../import/index.js'
import { analyzeReactFile } from './file.js'
import { analyzeReactUsage } from './index.js'

vi.mock('../import/index.js', () => ({
  analyzeDependenciesForEntries: vi.fn(),
}))

vi.mock('./file.js', () => ({
  analyzeReactFile: vi.fn(),
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('analyzeReactUsage', () => {
  it('exports a callable react analyzer', () => {
    expect(analyzeReactUsage).toBeTypeOf('function')
  })

  it('builds dependencies once for multi-entry analysis', () => {
    vi.mocked(analyzeDependenciesForEntries).mockReturnValue({
      cwd: '/repo',
      entryId: '/repo/src/a.tsx',
      entryIds: ['/repo/src/a.tsx', '/repo/src/b.tsx'],
      nodes: new Map(),
    })
    vi.spyOn(fs, 'readFileSync').mockReturnValue('')
    vi.mocked(analyzeReactFile).mockReturnValue({
      filePath: '/repo/src/a.tsx',
      importsByLocalName: new Map(),
      exportsByName: new Map(),
      reExportBindingsByName: new Map(),
      exportAllBindings: [],
      entryUsages: [],
      allSymbolsById: new Map(),
      allSymbolsByName: new Map(),
      symbolsById: new Map(),
      symbolsByName: new Map(),
    })

    analyzeReactUsage(['src/a.tsx', 'src/b.tsx'], { cwd: '/repo' })

    expect(analyzeDependenciesForEntries).toHaveBeenCalledTimes(1)
    expect(analyzeDependenciesForEntries).toHaveBeenCalledWith(
      ['src/a.tsx', 'src/b.tsx'],
      { cwd: '/repo', trackUnusedImports: false },
    )
  })
})
