# Checklist Proof Tool Calls Design

## Problem

`missionControl.resume.checklist` is the ordered task card agents are told to follow, but `run_proof` checklist rows currently carry only CLI commands.

The adjacent `remainingProofItems` and `remainingProofToolCalls` fields already know which proof steps are MCP-callable. That forces agents using the checklist as their single sequence to cross-reference a second list before calling proof tools.

## Goals

- Add MCP tool metadata to proof execution steps when a proof command maps to a projscan MCP tool.
- Let `missionControl.resume.checklist` proof rows inherit `tool` and `args` from those execution steps.
- Keep CLI-only proof steps as command-only checklist rows.
- Keep `remainingProofItems`, `remainingProofCommands`, and `remainingProofToolCalls` backward compatible.

## Non-Goals

- Adding new proof commands.
- Changing command strings.
- Making every CLI command MCP-callable.
- Removing the existing `remainingProofToolCalls` convenience view.

## Design

When building the `Proof` phase in `missionControl.executionPlan`, map each proof command through the existing proof-command-to-tool matcher:

```json
{
  "id": "proof-2",
  "kind": "proof",
  "status": "ready",
  "label": "projscan preflight --mode before_edit --format json",
  "command": "projscan preflight --mode before_edit --format json",
  "tool": "projscan_preflight",
  "args": { "mode": "before_edit" }
}
```

`resumeChecklistItemFromStep` already copies `tool` and `args`, so `missionControl.resume.checklist` becomes self-contained for mapped proof steps. Unmapped proof such as `projscan handoff` remains:

```json
{
  "kind": "run_proof",
  "stepId": "proof-6",
  "command": "projscan handoff"
}
```

`remainingProofItems` and `remainingProofToolCalls` should read existing checklist `tool` / `args` first, falling back to command parsing for compatibility.

## Test Plan

- Extend core `start` tests to assert:
  - `executionPlan` proof steps include `tool` and `args` for mapped proof commands.
  - `resume.checklist` `run_proof` rows include `tool` and `args` for mapped proof commands.
  - CLI-only `projscan handoff` remains command-only.
- Extend MCP start tests with the same externally visible JSON behavior.
- Run focused start suites before the full verification gates.
