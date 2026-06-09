# Resume Checklist Design

## Problem

Mission Control now exposes a resume command, MCP tool call, input bindings, and follow-up templates. A resumed agent can continue safely, but the completion path is still split across `resume`, `executionPlan`, `proofCommands`, and `successCriteria`. Agents that want one compact task card still need to stitch those fields together and avoid rerunning commands that are already the current resume action.

## Product Goal

Make resume handoffs executable from one object. `missionControl.resume` should include an ordered checklist that says what to run now, which values to collect, which templates to call next, which remaining proof commands to run, and which done criteria to confirm.

## Approach

Add optional `missionControl.resume.checklist` with additive checklist items:

- `run_current` for the current cursor command or tool call.
- `resolve_input` for unlocked input bindings.
- `run_follow_up` for the follow-up templates enabled by those inputs.
- `run_proof` for proof commands that remain after removing the current command.
- `confirm_done` for done criteria.

Each item carries `stepId`, `phaseId`, `status`, `label`, and only the fields needed for that item, such as `command`, `tool`, `args`, `placeholder`, `instruction`, `blockedBy`, or `followUpIds`.

The runbook will render the same checklist under `Resume checklist:` so humans and agents see the same sequence.

## Data Flow

`missionResume` already receives the execution plan. It can derive the checklist from the cursor, resolved input bindings, follow-up steps, proof phase, and done criteria phase. Proof checklist items will skip the current command to avoid duplicate work.

## Testing

Add failing core, MCP, and CLI tests before implementation:

- JSON resume payload includes ordered checklist items for current, inputs, follow-ups, proof, and done criteria.
- Proof checklist items exclude the current command.
- Handoff/runbook resume copies the checklist unchanged.
- Runbook Markdown and `--include-handoff` console output include `Resume checklist:` lines.
