# Cursor-Aligned Current Phase Design

## Problem

Mission Control now exposes an execution cursor, resume object, runbook, and proof queues. The remaining confusing detail is that `missionControl.executionPlan.currentPhase` can report `next_action` while `missionControl.executionPlan.cursor.phaseId` reports `ready_now`. The JSON is technically derivable, but an agent should not have to decide which phase is authoritative.

## Goal

Make the operational current phase point at the same phase as the execution cursor. If the cursor says the next runnable step is in `ready_now`, then `executionPlan.currentPhase` and `runbook.currentPhase` should also say `ready_now`.

## Design

Keep the existing execution-plan phases and step ordering. `next_action` remains in the phase graph as the headline action. Change only the top-level `currentPhase` selection:

- Build phases as before.
- Select the cursor as before.
- Set `executionPlan.currentPhase` to `cursor.phaseId`.
- Continue copying that value into `missionControl.runbook.currentPhase` and Markdown runbooks.

This avoids a breaking removal of the `next_action` phase while making the main phase pointer match the runnable cursor.

## Tests

- Core start test: fuzzy routed intents should have `executionPlan.currentPhase === executionPlan.cursor.phaseId === "ready_now"`.
- MCP start test: MCP payload should expose the same aligned phase.
- CLI runbook test: `Agent Runbook` should print `Current phase: ready_now`.

## Documentation

Update the unreleased README and guide notes to say that `currentPhase` is cursor-aligned and that the full phase graph still contains the headline `next_action` phase.
