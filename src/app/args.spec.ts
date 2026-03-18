import { expectTypeOf, it } from 'vitest'

import type {
  CliOptions,
  DepsCliOptions,
  ImportCliOptions,
  ReactCliOptions,
} from './args.js'

it('models discriminated CLI option shapes', () => {
  expectTypeOf<CliOptions>().toEqualTypeOf<
    DepsCliOptions | ImportCliOptions | ReactCliOptions
  >()
})
