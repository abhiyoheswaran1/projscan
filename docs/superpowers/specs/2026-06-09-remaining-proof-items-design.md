# Remaining Proof Items Design

## Problem

`missionControl.resume.remainingProofCommands` contains every remaining proof command after the current cursor, while `remainingProofToolCalls` contains only proof commands that can be mapped to MCP tools. That split is useful, but it can hide a gap: if an agent consumes only MCP-native calls, it may miss an unmapped proof command such as `projscan handoff`.

## Goal

Expose one ordered remaining-proof queue that preserves every proof step and annotates mapped MCP calls when available.

## Approaches

1. Add `remainingProofItems` to `missionControl.resume` and mirror it under `missionControl.handoff.readyProof.items`.
   This is the recommended path because it is additive, keeps existing command and tool-call fields stable, and gives agents one complete proof queue.
2. Add only `readyProof.unmappedCommands`.
   This is smaller, but consumers still need to merge three fields to reconstruct the proof order.
3. Expand `remainingProofToolCalls` to include CLI-only entries.
   This would blur the current tool-call contract and risks surprising MCP consumers that expect callable tools.

## Design

Add a `StartMissionProofItem` shape:

- `stepId`: the execution-plan proof step id.
- `status`: the proof step status.
- `label`: the human-readable proof label.
- `command`: the CLI command for the proof step.
- `toolCall`: optional MCP-native call when the command is mapped.

Populate `missionControl.resume.remainingProofItems` from the existing resume checklist proof items. Then derive or copy the same queue into `missionControl.handoff.readyProof.items`. Keep these existing fields unchanged:

- `missionControl.resume.remainingProofCommands`
- `missionControl.resume.remainingProofToolCalls`
- `missionControl.handoff.readyProof.commands`
- `missionControl.handoff.readyProof.toolCalls`
- `missionControl.proofCommands`

## Testing

- Core start test: a handoff intent should include `projscan handoff` in `remainingProofItems` without a `toolCall`, while mapped proof items include their MCP calls.
- MCP start test: the same ordered items should be exposed through `handoff.readyProof.items`.
- CLI JSON test: `--format json` should show the same ready-proof item queue and preserve unmapped proof.

## Documentation

Update README, guide, and changelog to explain that `remainingProofItems` is the complete ordered proof queue, while `remainingProofToolCalls` is the callable MCP subset.
