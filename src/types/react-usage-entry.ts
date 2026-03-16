import type { ReactUsageLocation } from './react-usage-location.js'

export interface ReactUsageEntry {
  readonly target: string
  readonly location: ReactUsageLocation
}
