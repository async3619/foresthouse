import { Button } from './Button'

const registry = {
  Button,
}

export function DynamicHost() {
  const Current = registry.Button
  return <Current />
}
