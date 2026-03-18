import { describe, expect, it } from 'vitest'

import { BaseAnalyzer } from './base.js'

describe('BaseAnalyzer', () => {
  it('delegates analysis to subclasses', () => {
    class TestAnalyzer extends BaseAnalyzer<string> {
      protected doAnalyze(): string {
        return this.options.cwd ?? this.entryFile
      }
    }

    expect(new TestAnalyzer('src/main.ts', { cwd: '/repo' }).analyze()).toBe(
      '/repo',
    )
  })
})
