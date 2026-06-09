# Start Next Command Flag Design

## Problem

`projscan start --intent "<goal>"` now builds a precise Mission Control execution cursor. The full console output shows `Run Cursor` and the current command, but developers still have to scan a long report or parse JSON when they only want the exact command to run next.

The product already measures next-command clarity through feedback. A direct command-only shortcut should make that loop easier to use in terminals, scripts, editors, and agent harnesses.

## Goal

Add `projscan start --next-command`, a console shortcut that prints only the current runnable Mission Control cursor command plus a trailing newline.

Example:

```bash
projscan start --intent "what breaks if I rename the auth token loader" --next-command --quiet
```

Output:

```text
projscan search "auth token loader" --format json
```

## Non-Goals

- Do not change `missionControl.executionPlan.cursor`.
- Do not change JSON output shape.
- Do not add a new `--format` value.
- Do not execute the command.
- Do not release, publish, deploy, push, or update registry metadata.

## Design

Add a boolean `--next-command` option to `src/cli/commands/start.ts`.

Behavior:

- Compute the normal start report.
- If `--format json` is requested, keep existing JSON behavior and ignore `--next-command`; JSON already includes `missionControl.executionPlan.cursor.command`.
- In console mode with `--next-command`, print `report.missionControl.executionPlan.cursor.command` and return before the full report.
- If the cursor has no runnable command, print a concise error to stderr and exit 1. This keeps the flag honest: `--next-command` means command-only output.

`--handoff-prompt` remains separate. If both `--handoff-prompt` and `--next-command` are passed in console mode, `--next-command` wins because it is narrower and explicitly command-only.

## Tests

- CLI: `projscan start --intent "<fuzzy impact>" --next-command --quiet` exits 0, prints only `projscan search "auth token loader" --format json`, and omits report headings.
- CLI: `--next-command --format json` still emits full JSON with the cursor command and runbook content.
- Existing start CLI tests continue to pass.

## Docs

Update README, guide, and changelog near the existing Mission Control shortcut docs.

## Self-Review

- No placeholders remain.
- Scope is limited to CLI presentation and docs.
- The implementation reuses the existing cursor command and does not create parallel routing logic.
- The error behavior for non-command cursors is explicit.
