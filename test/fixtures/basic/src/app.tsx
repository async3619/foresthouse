import { formatLabel } from '@/shared/util'
import { Button } from './components/button.js'
// biome-ignore lint/correctness/noUnusedImports: fixture for unused import detection
import { unusedLabel } from './unused-helper.js'

export function App() {
  return Button({ label: formatLabel('foresthouse') })
}
