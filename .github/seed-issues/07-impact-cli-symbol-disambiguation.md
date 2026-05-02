# `projscan impact --symbol` should warn when the name is defined in multiple files

**Difficulty:** small · **Scope:** ~30 LOC + tests

## What

`projscan_impact` in symbol mode returns the symbol's `definitionFiles` array. When the symbol is defined in multiple files (a name collision), the impact report attributes callers to all of them — which is correct given the static graph but misleading to a reader who assumes one definition. Add a CLI warning when `definitionFiles.length > 1`.

## Where

- `src/cli/commands/impact.ts` — after the report is computed, before the formatter is called, check `report.target.kind === 'symbol' && report.definitionFiles.length > 1` and print a `chalk.yellow` warning to stderr.
- `tests/core/impact.test.ts` — already has a test that covers multi-definition; extend or add a CLI-level smoke test if useful.

## How

```ts
if (report.available && report.target.kind === 'symbol' && report.definitionFiles.length > 1) {
  console.error(
    chalk.yellow(
      `\n  ⚠ "${report.target.value}" is defined in ${report.definitionFiles.length} files. ` +
      `The reachable set below includes callers of all definitions.\n`,
    ),
  );
}
```

## Done condition

- Manual test: create a fixture with two files defining `foo`, run `projscan impact --symbol foo`, verify the warning prints.
- Existing tests still pass.
- The warning goes to stderr, not stdout, so it doesn't pollute `--format json` consumers.

## Why this is a good first issue

Targeted UX polish; no design questions; the test fixture pattern from `tests/core/impact.test.ts` is right next to where you're working.
