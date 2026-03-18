import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { toDisplayPath } from './to-display-path.js'

describe('toDisplayPath', () => {
  it('returns dot for the working directory itself', () => {
    const cwd = path.join(path.sep, 'repo')

    expect(toDisplayPath(cwd, cwd)).toBe('.')
  })

  it('returns normalized relative paths for files inside cwd', () => {
    const cwd = path.join(path.sep, 'repo')
    const filePath = path.join(cwd, 'src', 'components', 'button.tsx')

    expect(toDisplayPath(filePath, cwd)).toBe('src/components/button.tsx')
  })

  it('returns the original path for files outside cwd', () => {
    const cwd = path.join(path.sep, 'repo')
    const filePath = path.join(path.sep, 'shared', 'button.tsx')

    expect(toDisplayPath(filePath, cwd)).toBe(filePath)
  })
})
