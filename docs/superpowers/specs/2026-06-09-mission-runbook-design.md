# Mission Runbook Design

## Goal

Make Mission Control handoff-ready by adding a compact runbook derived from the execution plan. A developer or agent should be able to copy one artifact that explains the intent, current phase, ready commands, blocked inputs, proof commands, and done criteria.

## Product Shape

The previous slice added `missionControl.executionPlan`. The runbook should sit directly beside it as `missionControl.runbook`.

The runbook is for two audiences:

- Agents: consume `readyCommandBlock`, `blockedInputSummary`, and `markdown` without reinterpreting console prose.
- Humans: scan an `Agent Runbook` console section when running `projscan start --include-handoff`.

No new command or MCP tool is needed.

## Data Model

Add `missionControl.runbook` with:

- `title`: short title, based on the routed intent or primary action.
- `status`: same status as Mission Control.
- `currentPhase`: copied from the execution plan.
- `readyCommandBlock`: newline-joined ready commands with no placeholders.
- `blockedInputSummary`: concise sentence when missing inputs remain.
- `markdown`: copy-paste handoff including intent, next action, ready commands, blocked inputs, proof commands, and done criteria.

## Rendering

The normal console output already has Mission Control sections. To avoid extra noise, render `Agent Runbook` only when `projscan start --include-handoff` is used.

## Testing

- Core test: fuzzy impact intent includes a runbook with ready search command, blocked symbol/file input summary, proof, and done criteria.
- Core test: direct safety-gate intent has no blocked input summary and includes the ready preflight command.
- CLI test: `--include-handoff` prints `Agent Runbook`; default console output does not.
- MCP test: `projscan_start` returns the runbook in JSON.

## Constraints

- Additive JSON only.
- `readyCommandBlock` must not include placeholder commands.
- Markdown should be compact and deterministic.
- Keep existing `handoffPrompt` and top-level optional `handoff` untouched.
