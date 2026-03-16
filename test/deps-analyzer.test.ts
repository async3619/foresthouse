import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  analyzePackageDependencies,
  graphToSerializablePackageTree,
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
})
