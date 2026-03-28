import path from 'node:path'

import { bench, describe } from 'vitest'

import { createGitRepository } from '../../../bench/helpers.js'
import { analyzePackageDependencyDiff } from './diff.js'

const workspaceRepositoryRoot = createGitRepository(
  'foresthouse-deps-diff-bench-',
  [
    {
      message: 'initial',
      files: {
        'package.json': JSON.stringify(
          {
            name: 'deps-diff-bench',
            private: true,
            workspaces: ['apps/*', 'packages/*'],
          },
          null,
          2,
        ),
        'apps/web/package.json': JSON.stringify(
          {
            name: '@repo/web',
            dependencies: {
              '@repo/ui': 'workspace:*',
            },
          },
          null,
          2,
        ),
        'packages/ui/package.json': JSON.stringify(
          {
            name: '@repo/ui',
            dependencies: {
              clsx: '^2.1.1',
            },
          },
          null,
          2,
        ),
        'packages/ui/src/index.ts': 'export const button = "primary"\n',
      },
    },
    {
      message: 'update workspace source',
      files: {
        'package.json': JSON.stringify(
          {
            name: 'deps-diff-bench',
            private: true,
            workspaces: ['apps/*', 'packages/*'],
          },
          null,
          2,
        ),
        'apps/web/package.json': JSON.stringify(
          {
            name: '@repo/web',
            dependencies: {
              '@repo/ui': 'workspace:*',
            },
          },
          null,
          2,
        ),
        'packages/ui/package.json': JSON.stringify(
          {
            name: '@repo/ui',
            dependencies: {
              clsx: '^2.1.1',
            },
          },
          null,
          2,
        ),
        'packages/ui/src/index.ts': 'export const button = "secondary"\n',
      },
    },
  ],
)

const specifierRepositoryRoot = createGitRepository(
  'foresthouse-deps-spec-bench-',
  [
    {
      message: 'initial',
      files: {
        'package.json': JSON.stringify(
          {
            name: 'deps-diff-single',
            dependencies: {
              react: '^19.1.1',
              zod: '^3.25.0',
            },
          },
          null,
          2,
        ),
      },
    },
    {
      message: 'bump dependency',
      files: {
        'package.json': JSON.stringify(
          {
            name: 'deps-diff-single',
            dependencies: {
              react: '^19.2.0',
              zod: '^3.25.0',
            },
          },
          null,
          2,
        ),
      },
    },
  ],
)

describe('analyzePackageDependencyDiff', () => {
  bench('workspace source change', () => {
    analyzePackageDependencyDiff(
      path.join(workspaceRepositoryRoot, 'apps', 'web'),
      'HEAD~1..HEAD',
    )
  })

  bench('manifest specifier change', () => {
    analyzePackageDependencyDiff(specifierRepositoryRoot, 'HEAD~1..HEAD')
  })
})
