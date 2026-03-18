import { usePanelState } from '../hooks/usePanelState'
import { Button as PrimaryButton } from './Button'

export function Panel() {
  usePanelState()
  return <PrimaryButton />
}
