# Resume Remaining Proof Design

## Problem

`missionControl.resume.checklist` now removes the current command from later proof steps, but `missionControl.handoffPrompt` still uses the broader proof command list. For fuzzy impact routing, that makes the copy/paste handoff say to run the search command now and then include the same search command again in `Ready proof`.

## Product Goal

Make the smallest copyable handoff line match the executable resume checklist. A resumed agent should see one current action, then only the proof commands that remain after that current action.

## Approach

Add optional `missionControl.resume.remainingProofCommands`, derived from `resume.checklist` items with `kind: "run_proof"` and a concrete `command`.

Update `missionHandoffPrompt` to prefer `resume.remainingProofCommands` when present, falling back to the existing proof command list for compatibility. Keep `missionControl.proofCommands` unchanged because it still represents the full proof surface for the whole Mission Control plan.

## Runbook And Docs

Render `Remaining proof:` in the runbook resume section when the queue exists. Document that agents should use `resume.remainingProofCommands` or the `run_proof` checklist items after completing the current command and any follow-ups.

## Testing

Add failing tests first for:

- `resume.remainingProofCommands` excludes the current command and starts at the next proof command.
- `missionControl.handoffPrompt` does not include the current command in the `Ready proof` chain after the resume sentence.
- `missionControl.proofCommands` remains unchanged.
- MCP/runbook payloads copy the queue, and CLI runbook output renders `Remaining proof:`.
