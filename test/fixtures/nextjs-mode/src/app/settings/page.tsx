import { SettingsPanel } from '../../../components/SettingsPanel'
import { useSettings } from '../../../hooks/useSettings'

export default function SettingsPage() {
  useSettings()

  return <SettingsPanel />
}
