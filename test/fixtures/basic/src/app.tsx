import { formatLabel } from '@/shared/util'
import { Button } from './components/button.js'

export function App() {
  return Button({ label: formatLabel('foresthouse') })
}
