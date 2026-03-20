export type BenchmarkSize = 'large' | 'medium' | 'small'
export type BenchmarkTopology = 'monorepo' | 'single'
export type BenchmarkFramework = 'nextjs' | 'react'
export type BenchmarkCommand = 'react' | 'import' | 'deps'
export type BenchmarkTarget = 'entry' | 'nextjs' | 'directory'

export interface BenchmarkDefinitionSpec {
  description: string
  command: BenchmarkCommand
  target: BenchmarkTarget
  extraArgs: string[]
}

export const benchmarkDefinitions = {
  'deps-root': {
    description: 'Run `foresthouse deps <directory>` from the configured root.',
    command: 'deps',
    target: 'directory',
    extraArgs: [],
  },
  'import-entry': {
    description:
      'Run `foresthouse import <entry-file>` with an auto-discovered entry.',
    command: 'import',
    target: 'entry',
    extraArgs: [],
  },
  'import-entry-project-only': {
    description:
      'Run `foresthouse import <entry-file> --project-only` with an auto-discovered entry.',
    command: 'import',
    target: 'entry',
    extraArgs: ['--project-only'],
  },
  'import-entry-no-workspaces': {
    description:
      'Run `foresthouse import <entry-file> --no-workspaces` with an auto-discovered entry.',
    command: 'import',
    target: 'entry',
    extraArgs: ['--no-workspaces'],
  },
  'react-entry': {
    description:
      'Run `foresthouse react <entry-file>` with an auto-discovered entry.',
    command: 'react',
    target: 'entry',
    extraArgs: [],
  },
  'react-entry-project-only': {
    description:
      'Run `foresthouse react <entry-file> --project-only` with an auto-discovered entry.',
    command: 'react',
    target: 'entry',
    extraArgs: ['--project-only'],
  },
  'react-entry-no-workspaces': {
    description:
      'Run `foresthouse react <entry-file> --no-workspaces` with an auto-discovered entry.',
    command: 'react',
    target: 'entry',
    extraArgs: ['--no-workspaces'],
  },
  'react-nextjs': {
    description: 'Run `foresthouse react --nextjs`.',
    command: 'react',
    target: 'nextjs',
    extraArgs: [],
  },
  'react-nextjs-project-only': {
    description: 'Run `foresthouse react --nextjs --project-only`.',
    command: 'react',
    target: 'nextjs',
    extraArgs: ['--project-only'],
  },
  'react-nextjs-no-workspaces': {
    description: 'Run `foresthouse react --nextjs --no-workspaces`.',
    command: 'react',
    target: 'nextjs',
    extraArgs: ['--no-workspaces'],
  },
} as const satisfies Record<string, BenchmarkDefinitionSpec>

export type BenchmarkId = keyof typeof benchmarkDefinitions

export type BenchmarkDefinition<K extends BenchmarkId = BenchmarkId> = {
  id: K
} & (typeof benchmarkDefinitions)[K]

export interface ProjectBenchmark {
  id: BenchmarkId
  directory?: string
}

export interface BenchmarkProject {
  id: string
  repo: string
  cloneUrl: string
  defaultBranch: string
  stars: number
  size: BenchmarkSize
  topology: BenchmarkTopology
  framework: BenchmarkFramework
  cwd: string
  preferredEntries: string[]
  benchmarks: ProjectBenchmark[]
}

export const benchmarkProjects: BenchmarkProject[] = [
  {
    id: 'supabase-studio',
    repo: 'supabase/supabase',
    cloneUrl: 'https://github.com/supabase/supabase.git',
    defaultBranch: 'master',
    stars: 99298,
    size: 'large',
    topology: 'monorepo',
    framework: 'nextjs',
    cwd: 'apps/studio',
    preferredEntries: ['app/page.tsx', 'pages/index.tsx'],
    benchmarks: [
      { id: 'deps-root', directory: '.' },
      { id: 'import-entry' },
      { id: 'import-entry-project-only' },
      { id: 'import-entry-no-workspaces' },
      { id: 'react-entry' },
      { id: 'react-entry-project-only' },
      { id: 'react-entry-no-workspaces' },
      { id: 'react-nextjs' },
      { id: 'react-nextjs-project-only' },
      { id: 'react-nextjs-no-workspaces' },
    ],
  },
  {
    id: 'cal-com-web',
    repo: 'calcom/cal.com',
    cloneUrl: 'https://github.com/calcom/cal.com.git',
    defaultBranch: 'main',
    stars: 40629,
    size: 'large',
    topology: 'monorepo',
    framework: 'nextjs',
    cwd: 'apps/web',
    preferredEntries: ['app/page.tsx', 'pages/index.tsx'],
    benchmarks: [
      { id: 'deps-root', directory: '.' },
      { id: 'import-entry' },
      { id: 'import-entry-project-only' },
      { id: 'import-entry-no-workspaces' },
      { id: 'react-entry' },
      { id: 'react-entry-project-only' },
      { id: 'react-entry-no-workspaces' },
      { id: 'react-nextjs' },
      { id: 'react-nextjs-project-only' },
      { id: 'react-nextjs-no-workspaces' },
    ],
  },
  {
    id: 'outline-app',
    repo: 'outline/outline',
    cloneUrl: 'https://github.com/outline/outline.git',
    defaultBranch: 'main',
    stars: 37711,
    size: 'large',
    topology: 'single',
    framework: 'react',
    cwd: 'app',
    preferredEntries: ['index.tsx'],
    benchmarks: [
      { id: 'deps-root', directory: '..' },
      { id: 'import-entry' },
      { id: 'react-entry' },
    ],
  },
  {
    id: 'dub-web',
    repo: 'dubinc/dub',
    cloneUrl: 'https://github.com/dubinc/dub.git',
    defaultBranch: 'main',
    stars: 23203,
    size: 'medium',
    topology: 'monorepo',
    framework: 'nextjs',
    cwd: 'apps/web',
    preferredEntries: ['app/page.tsx', 'pages/index.tsx'],
    benchmarks: [
      { id: 'deps-root', directory: '.' },
      { id: 'import-entry' },
      { id: 'import-entry-project-only' },
      { id: 'import-entry-no-workspaces' },
      { id: 'react-entry' },
      { id: 'react-entry-project-only' },
      { id: 'react-entry-no-workspaces' },
      { id: 'react-nextjs' },
      { id: 'react-nextjs-project-only' },
      { id: 'react-nextjs-no-workspaces' },
    ],
  },
  {
    id: 'commerce',
    repo: 'vercel/commerce',
    cloneUrl: 'https://github.com/vercel/commerce.git',
    defaultBranch: 'main',
    stars: 13949,
    size: 'medium',
    topology: 'single',
    framework: 'nextjs',
    cwd: '.',
    preferredEntries: ['app/page.tsx', 'pages/index.tsx'],
    benchmarks: [
      { id: 'deps-root', directory: '.' },
      { id: 'import-entry' },
      { id: 'react-entry' },
      { id: 'react-nextjs' },
    ],
  },
  {
    id: 'formbricks-web',
    repo: 'formbricks/formbricks',
    cloneUrl: 'https://github.com/formbricks/formbricks.git',
    defaultBranch: 'main',
    stars: 11987,
    size: 'medium',
    topology: 'monorepo',
    framework: 'nextjs',
    cwd: 'apps/web',
    preferredEntries: ['app/page.tsx', 'pages/index.tsx'],
    benchmarks: [
      { id: 'deps-root', directory: '.' },
      { id: 'import-entry' },
      { id: 'import-entry-project-only' },
      { id: 'import-entry-no-workspaces' },
      { id: 'react-entry' },
      { id: 'react-entry-project-only' },
      { id: 'react-entry-no-workspaces' },
      { id: 'react-nextjs' },
      { id: 'react-nextjs-project-only' },
      { id: 'react-nextjs-no-workspaces' },
    ],
  },
  {
    id: 'platforms',
    repo: 'vercel/platforms',
    cloneUrl: 'https://github.com/vercel/platforms.git',
    defaultBranch: 'main',
    stars: 6644,
    size: 'small',
    topology: 'single',
    framework: 'nextjs',
    cwd: '.',
    preferredEntries: ['app/page.tsx', 'pages/index.tsx'],
    benchmarks: [
      { id: 'deps-root', directory: '.' },
      { id: 'import-entry' },
      { id: 'react-entry' },
      { id: 'react-nextjs' },
    ],
  },
  {
    id: 't3-nextjs',
    repo: 't3-oss/create-t3-turbo',
    cloneUrl: 'https://github.com/t3-oss/create-t3-turbo.git',
    defaultBranch: 'main',
    stars: 6001,
    size: 'small',
    topology: 'monorepo',
    framework: 'nextjs',
    cwd: 'apps/nextjs',
    preferredEntries: [
      'src/app/page.tsx',
      'src/pages/index.tsx',
      'src/main.tsx',
    ],
    benchmarks: [
      { id: 'deps-root', directory: '.' },
      { id: 'import-entry' },
      { id: 'import-entry-project-only' },
      { id: 'import-entry-no-workspaces' },
      { id: 'react-entry' },
      { id: 'react-entry-project-only' },
      { id: 'react-entry-no-workspaces' },
      { id: 'react-nextjs' },
      { id: 'react-nextjs-project-only' },
      { id: 'react-nextjs-no-workspaces' },
    ],
  },
]

export const defaultEntryCandidates: string[] = [
  'app/page.tsx',
  'app/page.ts',
  'app/page.jsx',
  'app/page.js',
  'pages/index.tsx',
  'pages/index.ts',
  'pages/index.jsx',
  'pages/index.js',
  'src/app/page.tsx',
  'src/app/page.ts',
  'src/pages/index.tsx',
  'src/pages/index.ts',
  'src/pages/index.jsx',
  'src/pages/index.js',
  'src/main.tsx',
  'src/main.ts',
  'src/main.jsx',
  'src/main.js',
  'src/index.tsx',
  'src/index.ts',
  'src/index.jsx',
  'src/index.js',
  'index.tsx',
  'index.ts',
]
