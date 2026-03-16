# foresthouse

`foresthouse` is a modern TypeScript-first Node.js CLI that starts from an entry file, follows local JavaScript and TypeScript imports, and prints the result as a dependency tree.

## Stack

- Node.js 24.14.0 LTS
- TypeScript 5.9
- `tsx` for fast TypeScript execution in development
- `tsdown` for fast ESM builds
- `Biome` for linting and formatting
- `Vitest` for tests
- `semantic-release` for automated pre-releases and releases
- npm publishing through `semantic-release` on GitHub Actions

## What it does

- Reads a JavaScript/TypeScript entry file (`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.mts`, `.cts`)
- Resolves local imports, re-exports, `require()`, and string-literal dynamic `import()`
- Honors the nearest `tsconfig.json` or `jsconfig.json`, including `baseUrl` and `paths`
- Expands sibling workspace packages by default, including their own `tsconfig` alias rules
- Prints a tree by default, or JSON with `--json`
- Colorizes ASCII output automatically when the terminal supports ANSI colors

## Usage

```bash
corepack enable
pnpm install
pnpm run build
node dist/cli.mjs import src/index.ts
```

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

### Options

`import` command:

- `foresthouse import <path>`: analyze an entry file by positional argument
- `foresthouse import --entry <path>`: analyze an entry file by explicit option
- `--cwd <path>`: working directory for resolving the entry file and config
- `--config <path>`: use a specific `tsconfig.json` or `jsconfig.json`
- `--include-externals`: include packages and Node built-ins in the output
- `--no-workspaces`: stop at sibling workspace package boundaries instead of expanding them
- `--project-only`: restrict traversal to the active `tsconfig.json` or `jsconfig.json` project
- `--no-unused`: omit imports that are never referenced
- `--json`: print a JSON tree instead of ASCII output

`react` command:

- `foresthouse react <path>`: print a React usage tree from an entry file
- `--cwd <path>`: working directory for resolving the entry file and config
- `--config <path>`: use a specific `tsconfig.json` or `jsconfig.json`
- `--filter <component|hook|builtin>`: limit the output to a specific React symbol kind
- `--builtin`: include built-in HTML nodes such as `button` and `div`
- `--no-workspaces`: stop at sibling workspace package boundaries instead of expanding them
- `--project-only`: restrict traversal to the active `tsconfig.json` or `jsconfig.json` project
- `--json`: print a JSON tree instead of ASCII output

## Development

```bash
corepack enable
pnpm install
pnpm run check
```

## Collaboration And Release Flow

- `dev` is the pre-release branch and publishes `-dev.N` builds through `semantic-release`
- `main` is the stable release branch
- every code change starts from a GitHub issue and lands through a pull request
- all commits must follow Conventional Commits
- Biome is the only formatter and linter in this repository
- CI runs lint, typecheck, build, and release automation
- npm publishing is configured through `semantic-release` with `NPM_TOKEN` and GitHub Actions provenance
