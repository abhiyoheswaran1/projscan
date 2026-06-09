# Console Resume Checklist Design

## Problem

`missionControl.resume.checklist` is now the best single task card for resuming a routed intent: it includes the current action, unresolved inputs, follow-up templates, remaining proof, and done criteria. The full Markdown runbook renders that checklist, but the normal `projscan start --intent "<goal>"` console path still requires developers to combine `Execution Plan`, `Run Cursor`, `Ready Now`, `Needs Input`, `Done When`, and `Proof Queue` by eye.

That makes the default terminal flow less helpful than the handoff flow, even though most humans will start with the default console output.

## Goal

Render a compact `Resume Checklist` section in default console Mission Control output whenever `missionControl.resume.checklist` is present.

The section should:

- Reuse the existing checklist ordering and statuses.
- Show the same action text as the runbook checklist.
- Append `(MCP: ...)` for callable checklist rows.
- Append `(CLI only)` for unmapped proof rows such as `projscan handoff`.
- Stay renderer-only; do not change the JSON contract.

## Non-Goals

- Adding new checklist fields.
- Removing existing `Execution Plan`, `Run Cursor`, `Ready Proof`, or `Proof Queue` sections.
- Rendering the entire Markdown runbook unless `--include-handoff` is passed.

## Design

Add a small console formatter in `src/cli/commands/start.ts` for `StartMissionResumeChecklistItem`. It mirrors the runbook checklist format but uses plain terminal text:

```text
Resume Checklist
- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})
- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.
- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})
- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})
```

Place the section immediately after `Run Cursor`, before the broader phase and action sections. That position answers "what do I do from here?" before the user reads supporting detail.

## Testing

- Extend the default fuzzy-impact console test to assert `Resume Checklist` appears without `--include-handoff`, includes current, input, follow-up, and proof rows with MCP annotations, and still does not print `Agent Runbook`.
- Extend the default handoff-intent console test to assert a CLI-only proof row appears in `Resume Checklist`.
- Keep existing runbook, core, and MCP tests unchanged because this slice only changes console rendering.
