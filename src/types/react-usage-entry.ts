import type { ReactUsageLocation } from './react-usage-location.js'

export interface ReactUsageEntry {
  readonly target: string
  readonly referenceName: string
  readonly location: ReactUsageLocation
}
