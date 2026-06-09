# Handoff-Visible Review Gate Design

## Context

Mission Control now produces `missionControl.reviewGate`, `--review-gate`, and `review-gate.md`. That helps JSON clients and saved bundles. Two important surfaces still miss the stop boundary:

- default console output
- `projscan start --handoff-json`

Those are high-frequency handoff paths. A human scanning normal `projscan start` output should see the stop rule before starting another slice. An agent using `--handoff-json` should receive the review gate inside the transfer object, not only in the full report.

## Goal

Make the review gate visible in the handoff path:

- default console output prints a compact `Review Gate` section
- `missionControl.handoff.reviewGate` carries the structured gate
- `projscan start --handoff-json` includes the same gate
- saved `handoff.json` includes the same gate because mission bundles already write `missionControl.handoff`

## Approach

Keep `missionControl.reviewGate` as the source of truth. Add it to `StartMissionHandoff` and pass the existing object into `missionHandoff`.

The console should not print the full Markdown gate. It should show the behavior and evidence commands in a short section:

```text
Review Gate
Stop after the current Mission Control checklist and proof are complete.
- git status --short
- git diff --stat
Stop and ask for approval before starting another slice, release, publish, or deploy.
```

This keeps normal start output readable while making the approval boundary explicit.

## Tests

Core tests should assert:

- `missionControl.handoff.reviewGate` equals `missionControl.reviewGate`

CLI tests should assert:

- default `projscan start --intent ...` output contains `Review Gate`
- `--handoff-json` includes `reviewGate`
- saved bundle `handoff.json` includes `reviewGate`

MCP tests should assert:

- `projscan_start` returns `missionControl.handoff.reviewGate`

## Docs

Update README, GUIDE, and CHANGELOG to state that the complete handoff object carries the review gate.

## Non-Goals

- Do not change the review gate checklist text.
- Do not add another CLI flag.
- Do not release, publish, deploy, or change the package version.
