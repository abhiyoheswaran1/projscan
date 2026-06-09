# Start Runbook Flag Design

## Problem

Mission Control has a rich Markdown runbook for handoff, but the CLI currently exposes it only inside the full console report with `--include-handoff`. That makes the artifact harder to pipe into a file, paste into an issue, or hand to another agent without trimming surrounding sections.

Developers need a clean command that returns the runbook itself.

## Goal

Add `projscan start --runbook`, a console shortcut that prints only `missionControl.runbook.markdown`.

Example:

```bash
projscan start --intent "what breaks if I rename the auth token loader" --runbook --quiet
```

The output should start with `# Mission Runbook` and include the existing Markdown sections such as `## Current Cursor`, `## Resume`, `## Handoff Prompt`, `## Ready Commands`, `## Blocked Inputs`, `## Proof Commands`, and `## Done When`.

## Non-Goals

- Do not change `missionControl.runbook`.
- Do not change JSON output shape.
- Do not change `--include-handoff`; it still embeds the runbook inside the full console report.
- Do not add a new `--format` value.
- Do not write files.
- Do not release, publish, deploy, push, or update registry metadata.

## Design

Add a boolean `--runbook` option to `src/cli/commands/start.ts`.

Behavior:

- Compute the normal start report.
- If `--format json` is requested, keep existing JSON behavior and ignore `--runbook`; JSON already includes `missionControl.runbook.markdown`.
- In console mode with `--runbook`, print `report.missionControl.runbook.markdown.trimEnd()` and return before the full report.
- If the runbook Markdown is empty, print a concise error to stderr and exit 1.

Shortcut precedence in console mode:

1. `--next-command`
2. `--proof-commands`
3. `--checklist`
4. `--runbook`
5. `--handoff-prompt`

This keeps the shortest machine-action outputs first, then the task card, then the full Markdown artifact, then the prose prompt.

## Tests

- CLI: `projscan start --intent "<fuzzy impact>" --runbook --quiet` exits 0, prints only the Markdown runbook, starts with `# Mission Runbook`, includes key runbook sections, and omits full report headings such as `Start:` and `Agent Runbook`.
- CLI: `--runbook --format json` still emits full JSON with `missionControl.runbook.markdown`.
- Existing start CLI tests continue to pass.

## Docs

Update README, guide, and changelog near the existing Mission Control shortcut docs.

## Self-Review

- No placeholders remain.
- Scope is limited to CLI presentation and docs.
- The implementation reuses the existing runbook Markdown without rebuilding it.
- JSON and MCP surfaces remain unchanged.
