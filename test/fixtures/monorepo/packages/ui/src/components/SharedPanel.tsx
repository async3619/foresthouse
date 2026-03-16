import { useSharedPanelState } from '@ui-internal/useSharedPanelState'

export function SharedPanel() {
  useSharedPanelState()
  return <section data-panel="shared" />
}
