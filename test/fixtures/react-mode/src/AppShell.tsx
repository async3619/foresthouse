import { useEffect } from 'react'
import { DynamicHost } from './components/DynamicHost'
import { Panel as PrimaryPanel } from './components/Panel'
import { useFeature } from './hooks/useFeature'

export function AppShell() {
  useEffect(() => {}, [])
  useFeature()

  return (
    <>
      <PrimaryPanel />
      <DynamicHost />
    </>
  )
}
