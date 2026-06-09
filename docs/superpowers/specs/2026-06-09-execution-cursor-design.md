# Execution Cursor Design

## Goal

Make Mission Control answer the most immediate operational question directly: what should the agent or developer run next?

The execution plan already exposes phases, dependencies, blocked inputs, and proof. A consumer can derive the next executable step, but that requires walking the phase graph. Add a small cursor so agents can run the right command without reinterpreting the plan.

## Product Shape

Add `missionControl.executionPlan.cursor` with:

- `phaseId`: the phase containing the selected step.
- `stepId`: the selected execution-step id.
- `status`: copied from the selected step.
- `kind`: copied from the selected step.
- `label`: copied from the selected step.
- `command`: present when the step has a runnable command.
- `instruction`: present when the step is an input step.
- `blockedBy`: copied when the selected step is blocked.
- `unlocks`: copied when the selected step unlocks later inputs or steps.
- `reason`: one short sentence explaining why this is the current cursor.

## Selection Rules

- Prefer the first ready command in the `ready_now` phase.
- If no ready command exists, select the first blocked input.
- If no input is blocked, select the first ready proof command.
- If no command or proof is ready, select the first done criterion.
- The cursor is derived from the execution plan and does not change command execution.

## Console

Print a compact `Run Cursor` section after `Execution Plan`:

- Ready command: show `command`.
- Blocked input: show `instruction`.
- Dependencies: show `blocked by` and `unlocks` when present.

## Testing

- Core test: fuzzy impact intent exposes a ready cursor for `ready-1`, including the search command and `unlocks`.
- MCP test: `projscan_start` returns the cursor in JSON.
- CLI test: console output prints `Run Cursor` and the current command.
- Existing execution-plan tests stay unchanged except for the added cursor field.

## Constraints

- Additive JSON only.
- No new command, flag, or MCP tool.
- No release, publish, or push.
