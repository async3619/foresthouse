import { useEffect } from 'react'

import { Panel } from './components/Panel'
import { useFeature } from './hooks/useFeature'

export default function EntryHookPage() {
  useEffect(() => {}, [])
  useFeature()

  return <Panel />
}
