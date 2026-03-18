import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { normalizeFilePath } from './normalize-file-path.js'

describe('normalizeFilePath', () => {
  it('delegates to node path normalization', () => {
    expect(normalizeFilePath('src/../src/main.ts')).toBe(
      path.normalize('src/../src/main.ts'),
    )
    expect(normalizeFilePath('./src//components/../main.tsx')).toBe(
      path.normalize('./src//components/../main.tsx'),
    )
  })
})
