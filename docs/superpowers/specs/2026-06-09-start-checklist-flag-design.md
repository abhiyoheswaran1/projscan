# Start Checklist Flag Design

## Problem

Mission Control now exposes focused shortcuts for the current command, handoff prompt, and proof commands. Developers still have to scan the full `projscan start` report when they want the ordered resume checklist that combines the current command, blocked inputs, follow-ups, proof, and done criteria.

That checklist is the closest thing to an actionable task card for a human or agent. It should be as easy to copy as the single next command.

## Goal

Add `projscan start --checklist`, a console shortcut that prints only the Mission Control resume checklist.

Example:

```bash
projscan start --intent "what breaks if I rename the auth token loader" --checklist --quiet
```

Expected output shape:

```text
- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})
- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.
- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})
- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})
```

The shortcut prints checklist rows only. It does not print headings or the rest of the start report, making the result easy to paste into an issue, PR note, agent prompt, or shell-adjacent scratchpad.

## Non-Goals

- Do not change `missionControl.resume.checklist`.
- Do not change JSON output shape.
- Do not add a new `--format` value.
- Do not change the default console report.
- Do not execute checklist commands.
- Do not release, publish, deploy, push, or update registry metadata.

## Design

Add a boolean `--checklist` option to `src/cli/commands/start.ts`.

Behavior:

- Compute the normal start report.
- If `--format json` is requested, keep existing JSON behavior and ignore `--checklist`; JSON already contains `missionControl.resume.checklist`.
- In console mode with `--checklist`, print `missionControl.resume.checklist`, one formatted row per line, and return before the full report.
- Reuse the existing `formatConsoleChecklistItem` function so shortcut output matches the default console `Resume Checklist` rows exactly, including MCP annotations and `CLI only` markers.
- If no checklist is available, print a concise error to stderr and exit 1.

Shortcut precedence in console mode:

1. `--next-command`
2. `--proof-commands`
3. `--checklist`
4. `--handoff-prompt`

Command-only output stays highest priority; the broader checklist comes before the prose handoff prompt because it is still structured task output.

## Tests

- CLI: `projscan start --intent "<fuzzy impact>" --checklist --quiet` exits 0, prints only checklist rows, omits headings, includes current command/input/follow-up/proof rows, and preserves MCP annotations.
- CLI: `--checklist --format json` still emits full JSON with `missionControl.resume.checklist`.
- Existing start CLI tests continue to pass.

## Docs

Update README, guide, and changelog near the existing Mission Control shortcut docs.

## Self-Review

- No placeholders remain.
- Scope is limited to CLI presentation and docs.
- The implementation reuses existing checklist formatting rather than creating a parallel representation.
- JSON and MCP surfaces remain unchanged.
