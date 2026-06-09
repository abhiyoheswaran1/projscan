# Runbook Cursor Handoff Design

## Goal

Keep Mission Control handoffs aligned with the execution cursor.

The execution plan now has `cursor`, but the compact handoff and Markdown runbook still force an agent to look elsewhere to find the single current step. When a task is paused or handed to another agent, the handoff artifact should preserve the same resume pointer.

## Product Shape

Add the execution cursor to:

- `missionControl.handoff.currentStep`
- `missionControl.runbook.currentStep`

Render the runbook with a `## Current Cursor` section:

- Step id and phase id.
- Command when available, or input instruction for blocked input cursors.
- `blockedBy` and `unlocks` when present.
- Cursor reason.

## Rules

- The runbook and handoff cursor are copied from `missionControl.executionPlan.cursor`.
- No independent cursor selection logic is added to the runbook.
- The Markdown runbook uses the cursor as the primary resume marker, while the existing Ready Commands, Blocked Inputs, Proof Commands, and Done When sections remain unchanged.

## Testing

- Core test: fuzzy impact intent exposes the same cursor on execution plan, handoff, and runbook; Markdown includes `## Current Cursor`, command, unlocks, and reason.
- MCP test: `projscan_start` returns the same cursor in handoff and runbook JSON.
- CLI test: `projscan start --include-handoff` prints the cursor inside `Agent Runbook`.

## Constraints

- Additive JSON only.
- No new commands or flags.
- No release, publish, push, or registry update.
