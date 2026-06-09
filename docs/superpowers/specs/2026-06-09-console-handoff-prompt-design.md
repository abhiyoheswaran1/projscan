# Console Handoff Prompt Design

## Problem

Mission Control already builds `missionControl.handoffPrompt`: a compact, copyable sentence that starts from the current cursor, names done criteria, carries blockers or unlocks, explains why the route was chosen, and includes remaining proof.

That prompt is available in JSON, and the full Markdown runbook is available with `--include-handoff`, but the default terminal output does not show the prompt. A developer using normal `projscan start --intent "<goal>"` still has to assemble a next-agent handoff from several sections.

## Goal

Render a compact `Handoff Prompt` section in default console Mission Control output.

The section should:

- Print `missionControl.handoffPrompt` verbatim.
- Appear after `Resume Checklist`, before the broader `Action Plan`.
- Avoid requiring `--format json` or `--include-handoff`.
- Stay renderer-only; do not change the JSON payload.

## Non-Goals

- Changing the wording or fields of `missionControl.handoffPrompt`.
- Rendering the full Markdown runbook without `--include-handoff`.
- Adding clipboard integration.
- Changing MCP payload shape.

## Design

Add a small `printHandoffPrompt(report)` helper in `src/cli/commands/start.ts`:

```text
Handoff Prompt
Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`. This can unlock input-1 (symbol), input-2 (file). Done when: ...
```

Place it immediately after `Resume Checklist` because both sections answer the operational resume question. The existing `Action Plan`, `Ready Now`, `Needs Input`, `Done When`, and proof sections remain unchanged.

## Testing

- Extend the default fuzzy-impact CLI console test to assert:
  - `Handoff Prompt` appears without `--include-handoff`.
  - It appears after `Resume Checklist` and before `Action Plan`.
  - It contains the resume-aware prompt text and remaining proof summary.
  - `Agent Runbook` is still not printed.
- Keep JSON/core tests unchanged because the underlying prompt contract already has coverage.
