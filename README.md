# foresthouse 🌲🏠

[![npm version](https://img.shields.io/npm/v/foresthouse.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/foresthouse)
[![codecov](https://img.shields.io/codecov/c/github/async3619/foresthouse?style=flat&colorA=000000&colorB=000000)](https://codecov.io/gh/async3619/foresthouse)
[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json&style=flat&colorA=000000&colorB=000000)](https://codspeed.io/async3619/foresthouse?utm_source=badge)
[![license](https://img.shields.io/npm/l/foresthouse?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/foresthouse)

`foresthouse` is a modern TypeScript-first Node.js CLI that can print source import trees, React usage trees, and package-manifest dependency trees.

## Installation

```bash
npm install -g foresthouse
```

You can also run it without a global install:

```bash
npx foresthouse --help
pnpm dlx foresthouse --help
yarn dlx foresthouse --help
bunx foresthouse --help
```

## What it does

- Analyzes source import trees from JavaScript and TypeScript entry files (`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`)
- Resolves local imports, re-exports, `require()`, and string-literal dynamic `import()`
- Honors the nearest `tsconfig.json` or `jsconfig.json`, including `baseUrl` and `paths`
- Expands sibling workspace packages by default, including their own `tsconfig` alias rules
- Analyzes React component and hook usage trees from explicit entry files or inferred Next.js app and pages routes
- Shows React tree changes relative to a Git ref or range with `foresthouse react --diff`
- Reads `package.json` manifests to show package-level dependency trees for single packages and monorepos
- Shows dependency-tree changes relative to a Git ref or range with `foresthouse deps --diff`
- Prints an ASCII tree by default, or JSON with `--json`
- Colorizes ASCII output automatically when the terminal supports ANSI colors

## Usage

```text
Usage:
  $ foresthouse <command> [options]

Commands:
  deps <directory>     Analyze package.json dependencies from a package directory.
  import [entry-file]  Analyze an entry file and print its dependency tree.
  react [entry-file]   Analyze React usage from an entry file.

For more info, run any command with the `--help` flag:
  $ foresthouse deps --help
  $ foresthouse import --help
  $ foresthouse react --help

Options:
  -h, --help     Display this message
  -v, --version  Display version number
```

### Commands

- `foresthouse import <entry-file>`: analyzes a JavaScript or TypeScript entry file and prints a dependency tree by following imports, re-exports, `require()`, and dynamic `import()`.
- `foresthouse react [entry-file]`: analyzes React component, hook, and render relationships and prints a React usage tree. It also supports automatic Next.js entry discovery with `--nextjs`, plus Git-based tree diffs with `--diff`.
- `foresthouse deps <directory>`: reads `package.json` manifests and workspace structure from a package directory and prints a package dependency tree. Use `--diff` to show only changes relative to a Git ref or range.

### Example

```bash
node dist/cli.mjs import src/main.ts --cwd test/fixtures/basic
```

Output:

```text
src/main.ts
├─ src/app.tsx
│  ├─ src/shared/util.ts
│  └─ src/components/button.tsx
├─ src/widget-loader.ts
│  └─ [dynamic] src/widgets/chart.ts
```

### `foresthouse import --help`

Analyzes a source dependency tree from a single entry file. You can provide the entry with either a positional argument or `--entry`, and use `--json` for machine-readable output.

```text
Usage:
  $ foresthouse import <entry-file> [options]

Options:
  --entry <path>       Entry file to analyze.
  --cwd <path>         Working directory used for relative paths.
  --config <path>      Explicit tsconfig.json or jsconfig.json path.
  --include-externals  Include packages and Node built-ins in the tree.
  --no-workspaces      Do not expand sibling workspace packages into source subtrees. (default: true)
  --project-only       Restrict traversal to the active tsconfig.json or jsconfig.json project.
  --unused             Include imports that are never referenced.
  --json               Print the dependency tree as JSON.
  -h, --help           Display this message
```

### `foresthouse react --help`

Analyzes React component and hook usage relationships. You can provide an entry file directly, or use `--nextjs` to discover Next.js route entries automatically.

```text
Usage:
  $ foresthouse react [entry-file] [options]

Options:
  --diff <git-ref-or-range>  Show only React tree changes relative to a Git revision or range.
  --cwd <path>     Working directory used for relative paths.
  --config <path>  Explicit tsconfig.json or jsconfig.json path.
  --nextjs         Infer Next.js page entries from app/ and pages/ when no entry is provided.
  --filter <mode>  Limit output to `component`, `hook`, or `builtin` usages.
  --builtin        Include built-in HTML nodes in the React tree.
  --no-workspaces  Do not expand sibling workspace packages into source subtrees. (default: true)
  --project-only   Restrict traversal to the active tsconfig.json or jsconfig.json project.
  --json           Print the React usage tree as JSON.
  -h, --help       Display this message
```

### `foresthouse deps --help`

Analyzes package-level dependency trees for both single-package projects and monorepos. Use `--diff` to show only dependency changes relative to a Git ref or range.

```text
Usage:
  $ foresthouse deps <directory> [options]

Options:
  --diff <git-ref-or-range>  Show only dependency-tree changes relative to a Git revision or range.
  --json                     Print the package tree as JSON.
  -h, --help                 Display this message
```

Common examples:

- `foresthouse import src/main.ts`
- `foresthouse import --entry src/main.ts --cwd test/fixtures/basic`
- `foresthouse react src/App.tsx`
- `foresthouse react src/App.tsx --diff origin/dev...HEAD`
- `foresthouse react --nextjs --cwd .`
- `foresthouse deps .`
- `foresthouse deps ./packages/a`
- `foresthouse deps . --diff origin/dev...HEAD`

## Benchmark

<details>
<summary>Environment</summary>

```
+----------+--------------+
| Metric   | Value        |
+----------+--------------+
| Platform | darwin arm64 |
| Node     | v24.14.0     |
| CPU      | Apple M2 Max |
| Cores    | 12           |
| Memory   | 32.0 GB      |
+----------+--------------+
```

</details>

<details>
<summary><code>foresthouse deps</code></summary>

```
+-----------+---------+-----------------+---------+---------+----------+----------+-------------------------------------------+
| Target    | Options | Project         | LOC     | Status  | Median   | P95      | Note                                      |
+-----------+---------+-----------------+---------+---------+----------+----------+-------------------------------------------+
| directory | (none)  | supabase-studio | 493,979 | ok      | 184.37ms | 216.11ms |                                           |
| directory | (none)  | cal-com-web     | 218,466 | ok      | 182.89ms | 196.84ms |                                           |
| directory | (none)  | outline-app     | 87,658  | ok      | 171.15ms | 172.83ms |                                           |
| directory | (none)  | dub-web         | 345,285 | ok      | 181.13ms | 186.52ms |                                           |
| directory | (none)  | commerce        | 3,968   | skipped | -        | -        | Package manifest is missing a valid name. |
| directory | (none)  | formbricks-web  | 247,895 | ok      | 171.78ms | 181.43ms |                                           |
| directory | (none)  | platforms       | 1,308   | skipped | -        | -        | Package manifest is missing a valid name. |
| directory | (none)  | t3-nextjs       | 711     | ok      | 173.51ms | 184.11ms |                                           |
+-----------+---------+-----------------+---------+---------+----------+----------+-------------------------------------------+
```

</details>

<details>
<summary><code>foresthouse import</code></summary>

```
+--------+-----------------+-----------------+---------+--------+-----------+-----------+------+
| Target | Options         | Project         | LOC     | Status | Median    | P95       | Note |
+--------+-----------------+-----------------+---------+--------+-----------+-----------+------+
| entry  | (none)          | supabase-studio | 493,979 | ok     | 1014.23ms | 1413.45ms |      |
| entry  | --project-only  | supabase-studio | 493,979 | ok     | 782.13ms  | 838.64ms  |      |
| entry  | --no-workspaces | supabase-studio | 493,979 | ok     | 782.02ms  | 833.00ms  |      |
| entry  | (none)          | cal-com-web     | 218,466 | ok     | 1042.08ms | 1109.40ms |      |
| entry  | --project-only  | cal-com-web     | 218,466 | ok     | 284.00ms  | 426.76ms  |      |
| entry  | --no-workspaces | cal-com-web     | 218,466 | ok     | 250.25ms  | 320.31ms  |      |
| entry  | (none)          | outline-app     | 87,658  | ok     | 600.36ms  | 840.67ms  |      |
| entry  | (none)          | dub-web         | 345,285 | ok     | 259.89ms  | 309.41ms  |      |
| entry  | --project-only  | dub-web         | 345,285 | ok     | 253.14ms  | 254.04ms  |      |
| entry  | --no-workspaces | dub-web         | 345,285 | ok     | 257.75ms  | 259.07ms  |      |
| entry  | (none)          | commerce        | 3,968   | ok     | 199.93ms  | 205.46ms  |      |
| entry  | (none)          | formbricks-web  | 247,895 | ok     | 333.93ms  | 405.91ms  |      |
| entry  | --project-only  | formbricks-web  | 247,895 | ok     | 313.35ms  | 342.89ms  |      |
| entry  | --no-workspaces | formbricks-web  | 247,895 | ok     | 296.93ms  | 355.40ms  |      |
| entry  | (none)          | platforms       | 1,308   | ok     | 189.81ms  | 199.19ms  |      |
| entry  | (none)          | t3-nextjs       | 711     | ok     | 217.94ms  | 247.73ms  |      |
| entry  | --project-only  | t3-nextjs       | 711     | ok     | 202.47ms  | 215.69ms  |      |
| entry  | --no-workspaces | t3-nextjs       | 711     | ok     | 200.04ms  | 200.67ms  |      |
+--------+-----------------+-----------------+---------+--------+-----------+-----------+------+
```

</details>

<details>
<summary><code>foresthouse react</code></summary>

```
+--------+-----------------+-----------------+---------+--------+-----------+-----------+------+
| Target | Options         | Project         | LOC     | Status | Median    | P95       | Note |
+--------+-----------------+-----------------+---------+--------+-----------+-----------+------+
| entry  | (none)          | supabase-studio | 493,979 | ok     | 1333.58ms | 1494.41ms |      |
| entry  | --project-only  | supabase-studio | 493,979 | ok     | 996.02ms  | 1059.62ms |      |
| entry  | --no-workspaces | supabase-studio | 493,979 | ok     | 1005.37ms | 1137.48ms |      |
| nextjs | (none)          | supabase-studio | 493,979 | ok     | 3059.37ms | 3534.34ms |      |
| nextjs | --project-only  | supabase-studio | 493,979 | ok     | 2602.21ms | 2716.90ms |      |
| nextjs | --no-workspaces | supabase-studio | 493,979 | ok     | 2716.09ms | 3007.85ms |      |
| entry  | (none)          | cal-com-web     | 218,466 | ok     | 1832.85ms | 1859.41ms |      |
| entry  | --project-only  | cal-com-web     | 218,466 | ok     | 244.83ms  | 347.60ms  |      |
| entry  | --no-workspaces | cal-com-web     | 218,466 | ok     | 242.31ms  | 249.87ms  |      |
| nextjs | (none)          | cal-com-web     | 218,466 | ok     | 4418.86ms | 5438.14ms |      |
| nextjs | --project-only  | cal-com-web     | 218,466 | ok     | 1400.78ms | 1498.16ms |      |
| nextjs | --no-workspaces | cal-com-web     | 218,466 | ok     | 1405.46ms | 1452.13ms |      |
| entry  | (none)          | outline-app     | 87,658  | ok     | 931.17ms  | 946.86ms  |      |
| entry  | (none)          | dub-web         | 345,285 | ok     | 265.47ms  | 273.70ms  |      |
| entry  | --project-only  | dub-web         | 345,285 | ok     | 266.99ms  | 268.79ms  |      |
| entry  | --no-workspaces | dub-web         | 345,285 | ok     | 265.71ms  | 276.33ms  |      |
| nextjs | (none)          | dub-web         | 345,285 | ok     | 1568.90ms | 1964.85ms |      |
| nextjs | --project-only  | dub-web         | 345,285 | ok     | 1589.73ms | 1624.88ms |      |
| nextjs | --no-workspaces | dub-web         | 345,285 | ok     | 1507.13ms | 1859.47ms |      |
| entry  | (none)          | commerce        | 3,968   | ok     | 213.42ms  | 218.10ms  |      |
| nextjs | (none)          | commerce        | 3,968   | ok     | 222.09ms  | 227.03ms  |      |
| entry  | (none)          | formbricks-web  | 247,895 | ok     | 381.40ms  | 391.71ms  |      |
| entry  | --project-only  | formbricks-web  | 247,895 | ok     | 321.40ms  | 331.36ms  |      |
| entry  | --no-workspaces | formbricks-web  | 247,895 | ok     | 323.95ms  | 327.12ms  |      |
| nextjs | (none)          | formbricks-web  | 247,895 | ok     | 1118.63ms | 1303.93ms |      |
| nextjs | --project-only  | formbricks-web  | 247,895 | ok     | 1041.12ms | 1062.49ms |      |
| nextjs | --no-workspaces | formbricks-web  | 247,895 | ok     | 1055.21ms | 1107.24ms |      |
| entry  | (none)          | platforms       | 1,308   | ok     | 201.30ms  | 205.59ms  |      |
| nextjs | (none)          | platforms       | 1,308   | ok     | 202.98ms  | 209.47ms  |      |
| entry  | (none)          | t3-nextjs       | 711     | ok     | 231.38ms  | 234.95ms  |      |
| entry  | --project-only  | t3-nextjs       | 711     | ok     | 212.96ms  | 214.89ms  |      |
| entry  | --no-workspaces | t3-nextjs       | 711     | ok     | 212.09ms  | 218.98ms  |      |
| nextjs | (none)          | t3-nextjs       | 711     | ok     | 232.97ms  | 233.53ms  |      |
| nextjs | --project-only  | t3-nextjs       | 711     | ok     | 211.67ms  | 215.33ms  |      |
| nextjs | --no-workspaces | t3-nextjs       | 711     | ok     | 211.65ms  | 215.49ms  |      |
+--------+-----------------+-----------------+---------+--------+-----------+-----------+------+
```

</details>

## Development

```bash
corepack enable
pnpm install
pnpm run test:unit
pnpm run test:e2e
pnpm run check
```

- Unit tests live next to source files as `src/**/*.spec.ts`.
- End-to-end command tests live under `e2e/`.
