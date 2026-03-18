import { describe, expect, it } from 'vitest'

import {
  collectTopLevelDynamicComponentCandidates,
  collectTopLevelReactSymbols,
} from './symbols.js'

describe('react symbol collectors', () => {
  it('export symbol collection helpers', () => {
    expect(collectTopLevelReactSymbols).toBeTypeOf('function')
    expect(collectTopLevelDynamicComponentCandidates).toBeTypeOf('function')
  })
})
