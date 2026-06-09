# Handoff Ready Proof Tool Calls Design

## Problem

`missionControl.handoff.readyProof.commands` now uses the resume remaining-proof queue, so structured handoff consumers no longer rerun the current cursor command. MCP-native proof calls still live only on `missionControl.resume.remainingProofToolCalls`. An agent that consumes the handoff object directly must jump back into `resume` to find the tool-call form.

## Goal

Make the handoff proof object complete for MCP agents. `missionControl.handoff.readyProof` should carry the same remaining proof commands and, when available, the matching MCP-native proof tool calls.

## Design

Extend the existing handoff ready-proof payload:

- Keep `readyProof.summary` unchanged.
- Keep `readyProof.commands` as the remaining-proof command queue.
- Add optional `readyProof.toolCalls`, copied from `resume.remainingProofToolCalls` when present.
- Do not derive new calls from unknown commands in this slice. Unknown proof remains available in `readyProof.commands`.
- Keep `missionControl.proofCommands` unchanged as the full proof surface for the whole plan.

This keeps the handoff self-contained while preserving backwards compatibility for CLI-oriented consumers.

## Tests

- Core start test: fuzzy impact handoff `readyProof.toolCalls` equals `resume.remainingProofToolCalls` and excludes `projscan_search`.
- MCP start test: MCP payload exposes the same tool calls through `handoff.readyProof.toolCalls`.
- CLI JSON test: `--format json` includes `handoff.readyProof.toolCalls` matching resume proof calls.

## Documentation

Update README, guide, and changelog to document `missionControl.handoff.readyProof.toolCalls` as the MCP-native proof queue for resumed handoffs.
