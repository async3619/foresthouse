# Change React ASCII output labels to JSX- and hook-style notation

## Summary

The `react` subcommand currently renders symbol kinds with bracket labels such as `[component]` and `[hook]`.
We want to keep those labels, but change the symbol portion of the ASCII output so React symbols look closer to the syntax developers already read every day:

- Components should render like `<Component /> [component]`
- Hooks should render like `useHook() [hook]`

## Motivation

- `<Component />` is easier to scan than a bare component identifier
- `useHook()` immediately communicates "this is a hook call"
- Keeping `[component]` and `[hook]` preserves the explicit kind label that the current output already provides
- The output becomes more React-native without losing the existing annotation style

## Current behavior

Examples from the current ASCII output:

```text
AppShell [component] (src/AppShell.tsx)
Panel as PrimaryPanel [component] (src/components/Panel.tsx)
useFeature [hook] (src/hooks/useFeature.ts)
usePanelState as usePanelStateAlias [hook] (src/hooks/usePanelState.ts)
```

## Proposed behavior

Render React symbols using syntax-shaped labels in ASCII mode while preserving the existing kind labels:

```text
<AppShell /> [component] (src/AppShell.tsx)
<Panel /> as PrimaryPanel [component] (src/components/Panel.tsx)
useFeature() [hook] (src/hooks/useFeature.ts)
usePanelState() as usePanelStateAlias [hook] (src/hooks/usePanelState.ts)
```

Notes:

- Apply this change only to the human-readable ASCII tree output
- Keep tree structure characters (`├─`, `└─`, `│`) unchanged
- Keep file path rendering unchanged
- Keep `[component]` / `[hook]` labels unchanged
- Keep JSON output unchanged
- Preserve existing alias information, but render it alongside the new symbol-style label

## Scope

- `foresthouse react ...` ASCII output
- Both root node labels and nested usage labels
- Entry-based output and root-based output
- Colored output mode should continue to work with the new label format

## Implementation notes

- The change likely belongs in `src/output/ascii/react.ts`
- Shared label formatting may belong in `src/color.ts` if colorized segments still need to differ between components and hooks
- Existing tests in `test/react-analyzer.test.ts` should be updated to assert the new label format
- JSON serializers and analyzers should not need behavior changes unless they currently assume bracketed labels

## Acceptance criteria

- Component nodes render as `<Name /> [component]` in ASCII output
- Hook nodes render as `name() [hook]` in ASCII output
- Aliased nodes still show both the original symbol name and the alias
- `--json` output remains unchanged
- Existing color behavior still works with the new label structure
- Tests cover plain and colorized output for components, hooks, and aliased symbols

## Open questions

- For aliased components, should we prefer `<Panel /> as PrimaryPanel` or `<PrimaryPanel /> (from Panel)`?
- If color is enabled, should the entire `<Component /> [component]` / `useHook() [hook]` token be colorized, or only the symbol name portion?
