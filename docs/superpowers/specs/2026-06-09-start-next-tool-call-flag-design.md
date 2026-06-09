# Start Next Tool Call Flag Design

## Problem

Mission Control already exposes the current cursor command through `projscan start --next-command`, but MCP agents still need to read the full JSON report or scrape console/runbook text to get the direct MCP tool call for that same cursor.

That is friction in the exact workflow projscan is optimizing: help agents move from intent to the next safe, callable action without reverse-engineering CLI strings.

## Goal

Add `projscan start --next-tool-call`, a console shortcut that prints only the current Mission Control cursor MCP tool call as compact JSON.

Example:

```bash
projscan start --intent "what breaks if I rename the auth token loader" --next-tool-call --quiet
```

Expected output:

```json
{"tool":"projscan_search","args":{"query":"auth token loader"}}
```

## Non-Goals

- Do not change `missionControl.resume.toolCall`.
- Do not change JSON output shape.
- Do not add a new `--format` value.
- Do not execute the MCP tool call.
- Do not change existing shortcut output.
- Do not release, publish, deploy, push, or update registry metadata.

## Design

Add a boolean `--next-tool-call` option to `src/cli/commands/start.ts`.

Behavior:

- Compute the normal start report.
- If `--format json` is requested, keep existing JSON behavior and ignore `--next-tool-call`; JSON already includes `missionControl.resume.toolCall`.
- In console mode with `--next-tool-call`, print `missionControl.resume.toolCall` as compact JSON and return before the full report.
- If `missionControl.resume.toolCall` is missing, fall back to `missionControl.executionPlan.cursor.tool` / `args` when present.
- If no MCP-callable current cursor is available, print a concise error to stderr and exit 1.

Shortcut precedence in console mode:

1. `--next-command`
2. `--next-tool-call`
3. `--proof-commands`
4. `--checklist`
5. `--runbook`
6. `--handoff-prompt`

This preserves the established shell-command shortcut precedence while adding the MCP-native equivalent before broader output shortcuts.

## Tests

- CLI: `projscan start --intent "<fuzzy impact>" --next-tool-call --quiet` exits 0 and prints only compact JSON for `projscan_search`.
- CLI: `--next-tool-call --format json` still emits full JSON with `missionControl.resume.toolCall`.
- Existing start CLI tests continue to pass.

## Docs

Update README, guide, and changelog near the existing Mission Control shortcut docs.

## Self-Review

- No placeholders remain.
- Scope is limited to CLI presentation and docs.
- The implementation reuses the existing resume/cursor tool-call data.
- JSON and MCP surfaces remain unchanged.
