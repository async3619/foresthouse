# foresthouse 🌲🏠

[![npm version](https://img.shields.io/npm/v/foresthouse.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/foresthouse)
[![codecov](https://img.shields.io/codecov/c/github/async3619/foresthouse?style=flat&colorA=000000&colorB=000000)](https://codecov.io/gh/async3619/foresthouse)
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
- `foresthouse react [entry-file]`: analyzes React component, hook, and render relationships and prints a React usage tree. It also supports automatic Next.js entry discovery with `--nextjs`.
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
- `foresthouse react --nextjs --cwd .`
- `foresthouse deps .`
- `foresthouse deps ./packages/a`
- `foresthouse deps . --diff origin/dev...HEAD`

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
