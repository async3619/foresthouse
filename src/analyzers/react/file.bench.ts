import fs from 'node:fs'
import path from 'node:path'

import { parseSync } from 'oxc-parser'
import { bench, describe } from 'vitest'

import { analyzeReactFile } from './file.js'

const fixturesDir = path.resolve(import.meta.dirname, '../../../test/fixtures')
const reactModeDir = path.join(fixturesDir, 'react-mode', 'src')

const appShellFixture = loadReactFileFixture('AppShell.tsx', {
  './components/DynamicHost': path.join(
    reactModeDir,
    'components',
    'DynamicHost.tsx',
  ),
  './components/Panel': path.join(reactModeDir, 'components', 'Panel.tsx'),
  './hooks/useFeature': path.join(reactModeDir, 'hooks', 'useFeature.ts'),
})

const styledEntryFixture = loadReactFileFixture('styled-entry.tsx', {
  './components/BaseCard': path.join(
    reactModeDir,
    'components',
    'BaseCard.tsx',
  ),
  './components/Link': path.join(reactModeDir, 'components', 'Link.tsx'),
})

describe('analyzeReactFile', () => {
  bench('AppShell symbol analysis', () => {
    analyzeReactFile(
      appShellFixture.program,
      appShellFixture.filePath,
      appShellFixture.sourceText,
      false,
      appShellFixture.sourceDependencies,
      false,
    )
  })

  bench('styled entry with builtin tracking', () => {
    analyzeReactFile(
      styledEntryFixture.program,
      styledEntryFixture.filePath,
      styledEntryFixture.sourceText,
      true,
      styledEntryFixture.sourceDependencies,
      true,
    )
  })
})

function loadReactFileFixture(
  relativePath: string,
  sourceDependencies: Readonly<Record<string, string>>,
): {
  readonly filePath: string
  readonly sourceText: string
  readonly program: ReturnType<typeof parseSync>['program']
  readonly sourceDependencies: ReadonlyMap<string, string>
} {
  const filePath = path.join(reactModeDir, relativePath)
  const sourceText = fs.readFileSync(filePath, 'utf8')
  const program = parseSync(filePath, sourceText, {
    astType: 'ts',
    sourceType: 'unambiguous',
  }).program

  return {
    filePath,
    sourceText,
    program,
    sourceDependencies: new Map(Object.entries(sourceDependencies)),
  }
}
