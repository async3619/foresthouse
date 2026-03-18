import { expectTypeOf, it } from 'vitest'

import type { AnalyzeOptions } from './analyze-options.js'

it('defines shared analyzer options', () => {
  expectTypeOf<AnalyzeOptions>().toMatchTypeOf<{
    cwd?: string
    configPath?: string
    expandWorkspaces?: boolean
    projectOnly?: boolean
    includeBuiltins?: boolean
  }>()
})
