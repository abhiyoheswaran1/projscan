# Console Resume-Aware Ready Proof Design

## Problem

The default Mission Control console now renders both `Resume Checklist` and `Proof Queue` from resume-aware data. Those sections avoid duplicating the current cursor command and show the proof that remains after the next action.

The older `Ready Proof` command list still renders the first commands from `missionControl.proofCommands`, which is intentionally the full plan proof surface. For fuzzy impact routing, that makes the console say:

- Run `projscan search "auth token loader" --format json` now.
- Then, under `Ready Proof`, run the same search command again.
- Then, under `Proof Queue`, run only the remaining proof commands.

That is technically explainable but operationally noisy for humans using the default terminal flow.

## Goal

Make the default console `Ready Proof` command list resume-aware by rendering `missionControl.handoff.readyProof.commands` instead of the full `missionControl.proofCommands` list when that queue exists.

This should:

- Keep `missionControl.proofCommands` unchanged in JSON as the full plan proof surface.
- Keep `missionControl.handoff.readyProof.commands` unchanged as the resume-aware remaining proof queue.
- Make default console `Ready Proof` align with `Proof Queue` and `Resume Checklist`.
- Avoid telling the developer to rerun the current cursor command as proof.

## Non-Goals

- Changing proof generation.
- Changing MCP payload shape.
- Removing the `Proof Queue` section.
- Removing `missionControl.proofCommands`.

## Design

In `src/cli/commands/start.ts`, keep the `Ready Proof` section but choose the command list from:

1. `mission.handoff.readyProof.commands`, when present.
2. `mission.proofCommands`, as a compatibility fallback.

The section still prints the existing `mission.proofSummary` and still limits the raw command list to the first three lines. The full ordered queue remains visible in `Proof Queue`.

Example:

```text
Ready Proof
Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.
- projscan preflight --mode before_edit --format json
- projscan understand --view verify --format json
- projscan session touched --format json
Proof Queue
- proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})
```

## Testing

- Update the default fuzzy-impact CLI console test so `Ready Proof` no longer contains the current search command.
- Keep assertions that `missionControl.proofCommands` still includes the current command in JSON/core tests.
- Verify the `Proof Queue` still renders the remaining proof items with MCP annotations.
