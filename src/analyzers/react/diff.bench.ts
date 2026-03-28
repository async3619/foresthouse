import { bench, describe } from 'vitest'

import { createGitRepository } from '../../../bench/helpers.js'
import type { ReactCliOptions } from '../../app/args.js'
import { analyzeReactUsageDiff } from './diff.js'

const repositoryRoot = createGitRepository('foresthouse-react-diff-bench-', [
  {
    message: 'initial',
    files: {
      'package.json': JSON.stringify(
        {
          name: 'react-diff-bench',
          private: true,
        },
        null,
        2,
      ),
      'tsconfig.json': JSON.stringify(
        {
          compilerOptions: {
            jsx: 'react-jsx',
          },
        },
        null,
        2,
      ),
      'src/main.tsx': [
        "import { AppShell } from './AppShell'",
        '',
        'void (<AppShell />)',
        '',
      ].join('\n'),
      'src/AppShell.tsx': [
        "import { Panel } from './components/Panel'",
        "import { useFeature } from './hooks/useFeature'",
        '',
        'export function AppShell() {',
        '  useFeature()',
        '  return <Panel />',
        '}',
        '',
      ].join('\n'),
      'src/components/Panel.tsx': [
        'export function Panel() {',
        '  return <section />',
        '}',
        '',
      ].join('\n'),
      'src/hooks/useFeature.ts': [
        'export function useFeature() {',
        '  return true',
        '}',
        '',
      ].join('\n'),
    },
  },
  {
    message: 'swap component and hook',
    files: {
      'package.json': JSON.stringify(
        {
          name: 'react-diff-bench',
          private: true,
        },
        null,
        2,
      ),
      'tsconfig.json': JSON.stringify(
        {
          compilerOptions: {
            jsx: 'react-jsx',
          },
        },
        null,
        2,
      ),
      'src/main.tsx': [
        "import { AppShell } from './AppShell'",
        '',
        'void (<AppShell />)',
        '',
      ].join('\n'),
      'src/AppShell.tsx': [
        "import { Button } from './components/Button'",
        "import { usePanelState } from './hooks/usePanelState'",
        '',
        'export function AppShell() {',
        '  usePanelState()',
        '  return <Button />',
        '}',
        '',
      ].join('\n'),
      'src/components/Button.tsx': [
        'export function Button() {',
        '  return <button />',
        '}',
        '',
      ].join('\n'),
      'src/hooks/usePanelState.ts': [
        'export function usePanelState() {',
        '  return { open: true }',
        '}',
        '',
      ].join('\n'),
    },
  },
])

const componentDiffOptions: ReactCliOptions = {
  command: 'react',
  entryFile: 'src/main.tsx',
  diff: 'HEAD~1..HEAD',
  cwd: repositoryRoot,
  configPath: undefined,
  expandWorkspaces: true,
  projectOnly: false,
  json: false,
  filter: 'component',
  nextjs: false,
  includeBuiltins: false,
}

const allDiffOptions: ReactCliOptions = {
  ...componentDiffOptions,
  filter: 'all',
}

describe('analyzeReactUsageDiff', () => {
  bench('component-only diff', () => {
    analyzeReactUsageDiff(componentDiffOptions)
  })

  bench('full component and hook diff', () => {
    analyzeReactUsageDiff(allDiffOptions)
  })
})
