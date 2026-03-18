# AGENT.md

This repository is GitHub-first. Agents and contributors must follow these rules for every change.

## Workflow

1. Start with a GitHub issue. If no issue exists yet, create one before making code changes.
   Issue titles must be written in natural language, not in Conventional Commit format.
   Do not add category prefixes such as `[Feature]:`, `[Fix]:`, or similar tags to issue titles.
2. Create a working branch from `dev`. Branch names must follow `codex/issue-<number>-<slug>`.
3. Open a pull request for every change. Direct pushes to `dev` and `main` are not allowed.
   Pull request titles must follow the Conventional Commit pattern.
4. Pull requests for normal work must target `dev`.
   Pull requests merged into `dev` must always use Squash Merge.
5. Only the `dev` branch may be merged into `main`, and that PR is the promotion path for official releases.

## Release model

- `dev` is the pre-release branch. `semantic-release` publishes `-dev.N` pre-releases from this branch.
- `main` is the official release branch. `semantic-release` publishes stable releases from this branch.
- Do not manually edit the package version for releases. `semantic-release` owns release versioning, tags, changelog updates, and GitHub releases.

## Commit rules

- Every commit must follow Conventional Commits with no exceptions.
- Preferred types are `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `style`, and `chore`.
- Use clear scopes when they help, for example `feat(cli): add json output`.
- Release commits are created automatically by `semantic-release`.

## Quality bar

- Use Biome for linting and formatting. Do not introduce ESLint or Prettier.
- This repository uses `pnpm`, declared via the `packageManager` field in `package.json`.
- Run `pnpm run check` before opening or updating a pull request.
- Keep automation and documentation in sync when workflow rules change.

## Notes for agents

- If a task arrives outside GitHub, create or identify the matching issue first, then continue.
- If a requested change would bypass the branching or release model, stop and explain the conflict.
- When opening a PR, include an issue reference such as `Closes #123` in the PR body.
