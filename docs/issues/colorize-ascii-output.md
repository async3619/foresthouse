# Add colorized ASCII output for unused nodes and React symbols

## Summary

The CLI currently prints plain ASCII trees only. We want to add terminal color to improve scanability, with a couple of specific requirements:

- Render the `(unused)` marker in orange.
- In React mode, render components and hooks with different colors.

## Motivation

- Plain text output is readable, but it becomes harder to scan as the tree grows.
- An `(unused)` marker should stand out immediately when reading the tree.
- React usage trees are easier to understand when component nodes and hook nodes are visually distinct.

## Proposed behavior

- Apply color only to human-readable ASCII output.
- Keep `--json` output unchanged.
- Render `(unused)` in orange anywhere it appears in the ASCII tree.
- In `--react` mode, use one color for component nodes and another color for hook nodes.
- Keep the tree structure characters (`├─`, `└─`, `│`) readable and avoid reducing contrast for file paths.
- Fall back to plain text when color is unavailable or disabled.

## Implementation notes

- The colorization likely belongs in the tree renderers rather than the analyzers.
- Expected touch points:
  - `src/tree.ts`
  - `src/react-tree.ts`
  - a small shared color utility if we want to centralize ANSI formatting
- We should decide whether to rely on raw ANSI sequences or add a tiny color helper dependency.
- It would be good to respect common terminal conventions such as non-TTY output and `NO_COLOR`.

## Acceptance criteria

- Standard ASCII output can highlight `(unused)` in orange.
- React ASCII output uses distinct colors for `[component]` and `[hook]` nodes.
- `--json` output remains byte-for-byte uncolored.
- Plain-text fallback still works when colors are disabled or unsupported.
- Tests cover the colored output behavior without making snapshots overly brittle.

## Open questions

- Should color be enabled automatically only for TTY output, or should we also expose an explicit CLI flag such as `--color` / `--no-color`?
- Should the color apply only to annotations like `[component]`, `[hook]`, and `(unused)`, or to the full node label?
