# Resume Automation Design

## Goal

Make Mission Control handoffs immediately resumable.

The execution cursor identifies the current step, and the runbook now carries that cursor. The remaining friction is that a resumed agent still has to turn the cursor into a command block or instruction. Add a normalized resume artifact so agents and humans can copy the next action directly.

## Product Shape

Add `missionControl.resume` and copy the same object into:

- `missionControl.handoff.resume`
- `missionControl.runbook.resume`

The resume object includes:

- `currentStep`: the execution cursor.
- `status`: copied from the cursor.
- `instruction`: one human-readable resume instruction.
- `prompt`: one compact agent prompt for continuing the task.
- `commandBlock`: present only when the cursor has a runnable command.

Render the Markdown runbook with `## Resume`:

- `Run now` and a shell code block when a command exists.
- `Do now` when the cursor is an input or criterion.
- `Prompt` for a resumed agent.

## Rules

- The resume object is derived from `executionPlan.cursor`.
- Do not add new command selection behavior.
- Do not include placeholder commands in `commandBlock`; if the cursor has no runnable command, omit `commandBlock` and use the instruction instead.
- Keep existing cursor, ready commands, blocked inputs, proof, and done criteria unchanged.

## Testing

- Core test: fuzzy impact intent exposes matching `resume` objects on Mission Control, handoff, and runbook; the command block is the ready search command.
- MCP test: `projscan_start` returns the resume object in JSON.
- CLI test: `projscan start --include-handoff` prints `## Resume` with the command block and prompt.

## Constraints

- Additive JSON only.
- No new commands or flags.
- No release, publish, push, or registry update.
