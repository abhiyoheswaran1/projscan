# Handoff Ready Proof Queue Design

## Problem

`missionControl.resume.remainingProofCommands` and the copyable `handoffPrompt` already avoid telling a resumed agent to rerun the current command. `missionControl.handoff.readyProof.commands` still uses the full `missionControl.proofCommands` list, so structured handoff consumers can duplicate the current resume action even though the richer resume payload does not.

## Goal

Make the structured handoff proof queue match the executable resume queue. A consumer that reads only `missionControl.handoff.readyProof.commands` should get proof commands that remain after the current cursor action.

## Design

Keep `missionControl.proofCommands` unchanged as the full proof surface for the whole Mission Control plan. Change only the handoff object:

- `missionControl.handoff.readyProof.commands` should prefer `resume.remainingProofCommands` when present.
- If the resume object has no remaining proof queue, fall back to the existing full `proofCommands` list.
- The handoff summary string stays unchanged.
- `missionControl.handoff.resume` remains the same object as `missionControl.resume`.

This is additive in behavior and narrows a duplicate-work trap for agents.

## Tests

- Core start test: fuzzy impact handoff `readyProof.commands` excludes the current search command and equals `resume.remainingProofCommands`.
- MCP start test: MCP payload exposes the same remaining proof queue through handoff.
- CLI JSON test: `--format json` handoff proof does not include the current resume command.

## Documentation

Update the README, guide, and changelog to say `handoff.readyProof.commands` is resume-aware and uses remaining proof when available.
