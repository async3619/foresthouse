import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import {
  analyzePackageDependencies,
  analyzePackageDependencyDiff,
  diffGraphToSerializablePackageTree,
  graphToSerializablePackageTree,
  printPackageDependencyDiffTree,
  printPackageDependencyTree,
} from '../src/index.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const singleFixtureDirectory = path.join(
  currentDirectory,
  'fixtures',
  'deps-single',
)
const monorepoFixtureDirectory = path.join(
  currentDirectory,
  'fixtures',
  'deps-monorepo',
)
const pnpmMonorepoFixtureDirectory = path.join(
  currentDirectory,
  'fixtures',
  'deps-pnpm-monorepo',
)
const temporaryDirectories: string[] = []

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true })
  })
})

describe('analyzePackageDependencies', () => {
  it('prints a single-package dependency tree with declared version specifiers', () => {
    const graph = analyzePackageDependencies(singleFixtureDirectory)
    const output = printPackageDependencyTree(graph, {
      color: false,
    })
    const jsonTree = graphToSerializablePackageTree(graph)

    expect(output).toBe(
      [
        'single-package-fixture',
        '├─ react@^19.1.1',
        '├─ tsup@^8.5.0',
        '└─ zod@^3.25.0',
      ].join('\n'),
    )
    expect(jsonTree).toMatchObject({
      kind: 'root',
      label: 'single-package-fixture',
      packageName: 'single-package-fixture',
      path: '.',
      dependencies: [
        {
          kind: 'external',
          name: 'react',
          specifier: '^19.1.1',
          target: 'react@^19.1.1',
        },
        {
          kind: 'external',
          name: 'tsup',
          specifier: '^8.5.0',
          target: 'tsup@^8.5.0',
        },
        {
          kind: 'external',
          name: 'zod',
          specifier: '^3.25.0',
          target: 'zod@^3.25.0',
        },
      ],
    })
  })

  it('expands internal workspace packages from a monorepo root', () => {
    const graph = analyzePackageDependencies(monorepoFixtureDirectory)
    const output = printPackageDependencyTree(graph, {
      color: false,
    })
    const jsonTree = graphToSerializablePackageTree(graph)

    expect(output).toBe(
      [
        'deps-monorepo-root',
        '├─ apps/web',
        '│  ├─ packages/ui (workspace:*)',
        '│  │  ├─ packages/config (workspace:*)',
        '│  │  │  └─ zod@^3.25.0',
        '│  │  └─ clsx@^2.1.1',
        '│  └─ react@^19.1.1',
        '├─ packages/config',
        '│  └─ zod@^3.25.0',
        '├─ packages/ui',
        '│  ├─ packages/config (workspace:*)',
        '│  │  └─ zod@^3.25.0',
        '│  └─ clsx@^2.1.1',
        '└─ typescript@^5.9.3',
      ].join('\n'),
    )
    expect(jsonTree).toMatchObject({
      kind: 'root',
      label: 'deps-monorepo-root',
      packageName: 'deps-monorepo-root',
      path: '.',
      dependencies: [
        {
          kind: 'workspace',
          name: '@repo/web',
          target: 'apps/web',
          node: {
            kind: 'workspace',
            label: 'apps/web',
            packageName: '@repo/web',
            dependencies: [
              expect.objectContaining({
                kind: 'workspace',
                target: 'packages/ui',
              }),
              expect.objectContaining({
                kind: 'external',
                target: 'react@^19.1.1',
              }),
            ],
          },
        },
        {
          kind: 'workspace',
          name: '@repo/config',
          target: 'packages/config',
        },
        {
          kind: 'workspace',
          name: '@repo/ui',
          target: 'packages/ui',
        },
        {
          kind: 'external',
          name: 'typescript',
          specifier: '^5.9.3',
          target: 'typescript@^5.9.3',
        },
      ],
    })
  })

  it('can analyze a workspace package directory while still resolving sibling workspaces', () => {
    const graph = analyzePackageDependencies(
      path.join(monorepoFixtureDirectory, 'apps', 'web'),
    )
    const output = printPackageDependencyTree(graph, {
      color: false,
    })
    const jsonTree = graphToSerializablePackageTree(graph)

    expect(output).toBe(
      [
        '@repo/web',
        '├─ packages/ui (workspace:*)',
        '│  ├─ packages/config (workspace:*)',
        '│  │  └─ zod@^3.25.0',
        '│  └─ clsx@^2.1.1',
        '└─ react@^19.1.1',
      ].join('\n'),
    )
    expect(jsonTree).toMatchObject({
      kind: 'root',
      label: '@repo/web',
      packageName: '@repo/web',
      path: 'apps/web',
      dependencies: [
        {
          kind: 'workspace',
          target: 'packages/ui',
          node: {
            kind: 'workspace',
            label: 'packages/ui',
            path: 'packages/ui',
            dependencies: [
              expect.objectContaining({
                kind: 'workspace',
                target: 'packages/config',
              }),
              expect.objectContaining({
                kind: 'external',
                target: 'clsx@^2.1.1',
              }),
            ],
          },
        },
        {
          kind: 'external',
          target: 'react@^19.1.1',
        },
      ],
    })
  })

  it('discovers monorepo workspaces from pnpm-workspace.yaml', () => {
    const graph = analyzePackageDependencies(pnpmMonorepoFixtureDirectory)
    const output = printPackageDependencyTree(graph, {
      color: false,
    })
    const jsonTree = graphToSerializablePackageTree(graph)

    expect(output).toBe(
      [
        'deps-pnpm-monorepo-root',
        '├─ apps/web',
        '│  ├─ packages/ui (workspace:*)',
        '│  │  ├─ packages/config (workspace:*)',
        '│  │  │  └─ zod@^3.25.0',
        '│  │  └─ clsx@^2.1.1',
        '│  └─ react@^19.1.1',
        '├─ packages/config',
        '│  └─ zod@^3.25.0',
        '├─ packages/ui',
        '│  ├─ packages/config (workspace:*)',
        '│  │  └─ zod@^3.25.0',
        '│  └─ clsx@^2.1.1',
        '└─ typescript@^5.9.3',
      ].join('\n'),
    )
    expect(jsonTree).toMatchObject({
      kind: 'root',
      label: 'deps-pnpm-monorepo-root',
      packageName: 'deps-pnpm-monorepo-root',
      path: '.',
      dependencies: [
        expect.objectContaining({
          kind: 'workspace',
          target: 'apps/web',
        }),
        expect.objectContaining({
          kind: 'workspace',
          target: 'packages/config',
        }),
        expect.objectContaining({
          kind: 'workspace',
          target: 'packages/ui',
        }),
        expect.objectContaining({
          kind: 'external',
          target: 'typescript@^5.9.3',
        }),
      ],
    })
  })

  it('shows changed dependency nodes for a single-package Git diff', () => {
    const repositoryRoot = createGitRepository([
      {
        message: 'initial',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-single-package',
              dependencies: {
                react: '^19.0.0',
                zod: '^3.25.0',
              },
            },
            null,
            2,
          ),
        },
      },
      {
        message: 'update dependencies',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-single-package',
              dependencies: {
                react: '^19.1.1',
                tsup: '^8.5.0',
              },
            },
            null,
            2,
          ),
        },
      },
    ])
    const graph = analyzePackageDependencyDiff(repositoryRoot, 'HEAD~1')
    const output = printPackageDependencyDiffTree(graph, {
      color: false,
    })
    const jsonTree = diffGraphToSerializablePackageTree(graph)

    expect(output).toBe(
      [
        '~ diff-single-package',
        '├─ ~ react@^19.0.0 -> ^19.1.1',
        '├─ + tsup@^8.5.0',
        '└─ - zod@^3.25.0',
      ].join('\n'),
    )
    expect(jsonTree).toMatchObject({
      kind: 'root',
      label: 'diff-single-package',
      packageName: 'diff-single-package',
      path: '.',
      change: 'changed',
      dependencies: [
        {
          kind: 'external',
          name: 'react',
          change: 'changed',
          before: {
            target: 'react@^19.0.0',
            specifier: '^19.0.0',
          },
          after: {
            target: 'react@^19.1.1',
            specifier: '^19.1.1',
          },
        },
        {
          kind: 'external',
          name: 'tsup',
          change: 'added',
          after: {
            target: 'tsup@^8.5.0',
            specifier: '^8.5.0',
          },
        },
        {
          kind: 'external',
          name: 'zod',
          change: 'removed',
          before: {
            target: 'zod@^3.25.0',
            specifier: '^3.25.0',
          },
        },
      ],
    })
  })

  it('prefers pnpm lockfile resolutions for lockfile-only dependency diffs', () => {
    const repositoryRoot = createGitRepository([
      {
        message: 'initial',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-lockfile-package',
              dependencies: {
                react: '^19.0.0',
              },
            },
            null,
            2,
          ),
          'pnpm-lock.yaml': [
            "lockfileVersion: '9.0'",
            '',
            'importers:',
            '  .:',
            '    dependencies:',
            '      react:',
            '        specifier: ^19.0.0',
            '        version: 19.1.0(next@15.0.0)(react-dom@18.2.0(react@18.2.0))',
            '',
          ].join('\n'),
        },
      },
      {
        message: 'update lockfile only',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-lockfile-package',
              dependencies: {
                react: '^19.0.0',
              },
            },
            null,
            2,
          ),
          'pnpm-lock.yaml': [
            "lockfileVersion: '9.0'",
            '',
            'importers:',
            '  .:',
            '    dependencies:',
            '      react:',
            '        specifier: ^19.0.0',
            '        version: 19.1.1(next@16.0.0)(react-dom@18.2.0(react@18.2.0))',
            '',
          ].join('\n'),
        },
      },
    ])

    const graph = analyzePackageDependencyDiff(repositoryRoot, 'HEAD~1')
    const output = printPackageDependencyDiffTree(graph, {
      color: false,
    })
    const jsonTree = diffGraphToSerializablePackageTree(graph)

    expect(output).toBe(
      ['~ diff-lockfile-package', '└─ ~ react@^19.0.0 (19.1.0 -> 19.1.1)'].join(
        '\n',
      ),
    )
    expect(jsonTree).toMatchObject({
      kind: 'root',
      label: 'diff-lockfile-package',
      packageName: 'diff-lockfile-package',
      path: '.',
      change: 'changed',
      dependencies: [
        {
          kind: 'external',
          name: 'react',
          change: 'changed',
          specifierChanged: false,
          resolvedVersionChanged: true,
          peerContextChanged: true,
          before: {
            target: 'react@^19.0.0',
            specifier: '^19.0.0',
            resolvedVersion: '19.1.0',
            peerContext: '(next@15.0.0)(react-dom@18.2.0(react@18.2.0))',
          },
          after: {
            target: 'react@^19.0.0',
            specifier: '^19.0.0',
            resolvedVersion: '19.1.1',
            peerContext: '(next@16.0.0)(react-dom@18.2.0(react@18.2.0))',
          },
          beforeResolvedVersion: '19.1.0',
          afterResolvedVersion: '19.1.1',
          beforePeerContext: '(next@15.0.0)(react-dom@18.2.0(react@18.2.0))',
          afterPeerContext: '(next@16.0.0)(react-dom@18.2.0(react@18.2.0))',
        },
      ],
    })
  })

  it('does not repeat identical specifiers when only peer context changes', () => {
    const repositoryRoot = createGitRepository([
      {
        message: 'initial',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-peer-context-package',
              dependencies: {
                'next-seo': '^6.0.0',
              },
            },
            null,
            2,
          ),
          'pnpm-lock.yaml': [
            "lockfileVersion: '9.0'",
            '',
            'importers:',
            '  .:',
            '    dependencies:',
            '      next-seo:',
            '        specifier: ^6.0.0',
            '        version: 6.0.0(next@15.0.0)(react@18.2.0)',
            '',
          ].join('\n'),
        },
      },
      {
        message: 'update peer context only',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-peer-context-package',
              dependencies: {
                'next-seo': '^6.0.0',
              },
            },
            null,
            2,
          ),
          'pnpm-lock.yaml': [
            "lockfileVersion: '9.0'",
            '',
            'importers:',
            '  .:',
            '    dependencies:',
            '      next-seo:',
            '        specifier: ^6.0.0',
            '        version: 6.0.0(next@16.0.0)(react@18.2.0)',
            '',
          ].join('\n'),
        },
      },
    ])

    const graph = analyzePackageDependencyDiff(repositoryRoot, 'HEAD~1')
    const output = printPackageDependencyDiffTree(graph, {
      color: false,
    })

    expect(output).toBe(
      ['~ diff-peer-context-package', '└─ ~ next-seo@^6.0.0'].join('\n'),
    )
  })

  it('can colorize dependency diff output', () => {
    const repositoryRoot = createGitRepository([
      {
        message: 'initial',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-color-package',
              dependencies: {
                react: '^19.0.0',
              },
            },
            null,
            2,
          ),
        },
      },
      {
        message: 'update dependencies',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-color-package',
              dependencies: {
                react: '^19.1.1',
                tsup: '^8.5.0',
              },
            },
            null,
            2,
          ),
        },
      },
    ])

    const output = printPackageDependencyDiffTree(
      analyzePackageDependencyDiff(repositoryRoot, 'HEAD~1'),
      {
        color: true,
      },
    )

    expect(output).toBe(
      [
        '\u001B[33m~ diff-color-package\u001B[0m',
        '├─ \u001B[33m~ react@^19.0.0 -> ^19.1.1\u001B[0m',
        '└─ \u001B[32m+ tsup@^8.5.0\u001B[0m',
      ].join('\n'),
    )
  })

  it('shows workspace edge changes for monorepo Git ranges', () => {
    const repositoryRoot = createGitRepository([
      {
        message: 'initial',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-monorepo-root',
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
                react: '^19.1.0',
              },
            },
            null,
            2,
          ),
          'packages/ui/package.json': JSON.stringify(
            {
              name: '@repo/ui',
              dependencies: {
                '@repo/config': 'workspace:*',
                clsx: '^2.1.1',
              },
            },
            null,
            2,
          ),
          'packages/config/package.json': JSON.stringify(
            {
              name: '@repo/config',
              dependencies: {
                zod: '^3.25.0',
              },
            },
            null,
            2,
          ),
        },
      },
      {
        message: 'switch workspace dependency',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-monorepo-root',
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
                '@repo/config': 'workspace:*',
                react: '^19.2.0',
              },
            },
            null,
            2,
          ),
          'packages/ui/package.json': JSON.stringify(
            {
              name: '@repo/ui',
              dependencies: {
                '@repo/config': 'workspace:*',
                clsx: '^2.1.1',
              },
            },
            null,
            2,
          ),
          'packages/config/package.json': JSON.stringify(
            {
              name: '@repo/config',
              dependencies: {
                zod: '^3.25.0',
              },
            },
            null,
            2,
          ),
        },
      },
    ])

    runGit(repositoryRoot, ['tag', '--force', 'base', 'HEAD~1'])

    const graph = analyzePackageDependencyDiff(
      path.join(repositoryRoot, 'apps', 'web'),
      'base...HEAD',
    )
    const output = printPackageDependencyDiffTree(graph, {
      color: false,
    })
    const jsonTree = diffGraphToSerializablePackageTree(graph)

    expect(output).toBe(
      [
        '~ @repo/web',
        '├─ + packages/config (workspace:*)',
        '│  └─ + zod@^3.25.0',
        '├─ - packages/ui (workspace:*)',
        '│  ├─ - clsx@^2.1.1',
        '│  └─ - packages/config (workspace:*)',
        '│     └─ - zod@^3.25.0',
        '└─ ~ react@^19.1.0 -> ^19.2.0',
      ].join('\n'),
    )
    expect(jsonTree).toMatchObject({
      kind: 'root',
      label: '@repo/web',
      packageName: '@repo/web',
      path: 'apps/web',
      change: 'changed',
      dependencies: [
        {
          kind: 'workspace',
          name: '@repo/config',
          change: 'added',
          afterTarget: 'packages/config',
          afterSpecifier: 'workspace:*',
          after: {
            target: 'packages/config',
            specifier: 'workspace:*',
          },
          node: {
            kind: 'workspace',
            path: 'packages/config',
            change: 'added',
          },
        },
        {
          kind: 'workspace',
          name: '@repo/ui',
          change: 'removed',
          beforeTarget: 'packages/ui',
          beforeSpecifier: 'workspace:*',
          before: {
            target: 'packages/ui',
            specifier: 'workspace:*',
          },
          node: {
            kind: 'workspace',
            path: 'packages/ui',
            change: 'removed',
          },
        },
        {
          kind: 'external',
          name: 'react',
          change: 'changed',
          beforeTarget: 'react@^19.1.0',
          beforeSpecifier: '^19.1.0',
          afterTarget: 'react@^19.2.0',
          afterSpecifier: '^19.2.0',
          before: {
            target: 'react@^19.1.0',
            specifier: '^19.1.0',
          },
          after: {
            target: 'react@^19.2.0',
            specifier: '^19.2.0',
          },
        },
      ],
    })
  })

  it('shows workspace specifier changes clearly in ASCII and JSON diff output', () => {
    const repositoryRoot = createGitRepository([
      {
        message: 'initial',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-monorepo-root',
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
                '@repo/ui': 'workspace:^1.0.0',
              },
            },
            null,
            2,
          ),
          'packages/ui/package.json': JSON.stringify(
            {
              name: '@repo/ui',
            },
            null,
            2,
          ),
        },
      },
      {
        message: 'update workspace dependency specifier',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-monorepo-root',
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
                '@repo/ui': 'workspace:^2.0.0',
              },
            },
            null,
            2,
          ),
          'packages/ui/package.json': JSON.stringify(
            {
              name: '@repo/ui',
            },
            null,
            2,
          ),
        },
      },
    ])

    const graph = analyzePackageDependencyDiff(
      path.join(repositoryRoot, 'apps', 'web'),
      'HEAD~1',
    )
    const output = printPackageDependencyDiffTree(graph, {
      color: false,
    })
    const jsonTree = diffGraphToSerializablePackageTree(graph)

    expect(output).toBe(
      [
        '~ @repo/web',
        '└─ ~ packages/ui (workspace:^1.0.0 -> workspace:^2.0.0)',
      ].join('\n'),
    )
    expect(jsonTree).toMatchObject({
      kind: 'root',
      label: '@repo/web',
      packageName: '@repo/web',
      path: 'apps/web',
      change: 'changed',
      dependencies: [
        {
          kind: 'workspace',
          name: '@repo/ui',
          change: 'changed',
          beforeTarget: 'packages/ui',
          beforeSpecifier: 'workspace:^1.0.0',
          afterTarget: 'packages/ui',
          afterSpecifier: 'workspace:^2.0.0',
          before: {
            target: 'packages/ui',
            specifier: 'workspace:^1.0.0',
          },
          after: {
            target: 'packages/ui',
            specifier: 'workspace:^2.0.0',
          },
          node: {
            kind: 'workspace',
            path: 'packages/ui',
            change: 'unchanged',
          },
        },
      ],
    })
  })

  it('treats workspace source changes as package changes in monorepo diffs', () => {
    const repositoryRoot = createGitRepository([
      {
        message: 'initial',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'diff-monorepo-root',
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
              name: 'diff-monorepo-root',
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
    ])

    const graph = analyzePackageDependencyDiff(
      path.join(repositoryRoot, 'apps', 'web'),
      'HEAD~1..HEAD',
    )
    const output = printPackageDependencyDiffTree(graph, {
      color: false,
    })
    const jsonTree = diffGraphToSerializablePackageTree(graph)

    expect(output).toBe(
      ['~ @repo/web', '└─ ~ packages/ui (workspace:*)'].join('\n'),
    )
    expect(jsonTree).toMatchObject({
      kind: 'root',
      label: '@repo/web',
      packageName: '@repo/web',
      path: 'apps/web',
      change: 'changed',
      dependencies: [
        {
          kind: 'workspace',
          name: '@repo/ui',
          change: 'unchanged',
          after: {
            target: 'packages/ui',
            specifier: 'workspace:*',
          },
          node: {
            kind: 'workspace',
            path: 'packages/ui',
            change: 'changed',
          },
        },
      ],
    })
  })

  it('reports invalid Git revisions clearly', () => {
    const repositoryRoot = createGitRepository([
      {
        message: 'initial',
        files: {
          'package.json': JSON.stringify(
            {
              name: 'git-error-fixture',
            },
            null,
            2,
          ),
        },
      },
    ])

    expect(() =>
      analyzePackageDependencyDiff(repositoryRoot, 'missing-ref'),
    ).toThrow(/Failed to resolve Git diff spec `missing-ref`:/)
  })
})

function createGitRepository(
  commits: readonly {
    readonly message: string
    readonly files: Readonly<Record<string, string>>
  }[],
): string {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'foresthouse-git-fixture-'),
  )

  temporaryDirectories.push(repositoryRoot)

  runGit(repositoryRoot, ['init'])
  runGit(repositoryRoot, ['config', 'user.name', 'Foresthouse Tests'])
  runGit(repositoryRoot, ['config', 'user.email', 'tests@example.com'])

  commits.forEach((commit) => {
    replaceRepositoryFiles(repositoryRoot, commit.files)
    runGit(repositoryRoot, ['add', '-A'])
    runGit(repositoryRoot, ['commit', '-m', commit.message])
  })

  return repositoryRoot
}

function replaceRepositoryFiles(
  repositoryRoot: string,
  files: Readonly<Record<string, string>>,
): void {
  fs.readdirSync(repositoryRoot, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === '.git') {
      return
    }

    fs.rmSync(path.join(repositoryRoot, entry.name), {
      recursive: true,
      force: true,
    })
  })

  Object.entries(files).forEach(([relativePath, fileContent]) => {
    const absolutePath = path.join(repositoryRoot, relativePath)

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
    fs.writeFileSync(absolutePath, fileContent)
  })
}

function runGit(repositoryRoot: string, args: readonly string[]): string {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim()
}
