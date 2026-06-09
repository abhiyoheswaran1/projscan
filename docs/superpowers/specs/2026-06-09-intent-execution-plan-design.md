# Intent Execution Plan Design

## Goal

Make `projscan start --intent "<goal>"` more directly useful to agents and developers by turning Mission Control's flat action list into a structured execution plan with phases, statuses, ready commands, blocked inputs, proof, and handoff.

## Product Shape

Projscan 4.1.0 routes a plain-language goal to the right tool and exposes a concrete action plan. The next additive slice should make that output easier for agents to consume without interpretation. The plan should answer: what can I run now, what is blocked on input, what proof should I gather, and what does done look like?

This remains inside the existing `start` product surface:

- CLI: `projscan start --intent "..."`
- MCP: `projscan_start`
- Core: `computeStartReport`

No new command or MCP tool is required.

## Data Model

Add `missionControl.executionPlan` with:

- `summary`: one-sentence plan state.
- `currentPhase`: first actionable or blocked phase id.
- `phases`: ordered execution phases.

Each phase has:

- `id`: stable short id.
- `title`: human-readable phase title.
- `status`: `ready`, `blocked`, or `pending`.
- `steps`: structured steps.

Each step has:

- `id`
- `kind`: `tool`, `input`, `proof`, `criterion`, or `handoff`
- `status`: `ready`, `blocked`, or `pending`
- `label`
- optional `command`, `tool`, `args`, `instruction`

## Phase Rules

1. `next_action`: always present, contains the primary action.
2. `ready_now`: present when ready actions exist; contains runnable actions without placeholders.
3. `resolve_inputs`: present when unresolved inputs exist; status `blocked`.
4. `follow_up`: present when there are pending action-plan steps after the ready actions.
5. `proof`: present when proof commands exist.
6. `done_when`: always present, contains success criteria.

The current phase is the first phase with `status` of `ready` or `blocked`; otherwise it falls back to `done_when`.

## CLI Rendering

Add a compact `Execution Plan` section under Mission Control:

- Shows each phase title with status.
- Prints ready commands.
- Prints blocked input instructions.
- Prints proof commands and done criteria.

Keep existing sections for compatibility and scanning.

## Testing

Use TDD:

- Core test: fuzzy impact intent includes a blocked input phase and runnable search proof.
- Core test: direct safety-gate intent has ready next-action/proof phases and no blocked input phase.
- MCP test: `projscan_start` returns execution plan phases with tool args.
- CLI test: console output renders `Execution Plan`, ready command, blocked inputs, and done criteria.

## Constraints

- Additive JSON only; no existing fields removed or renamed.
- Placeholder commands must not appear in ready/proof steps.
- Existing action plan, ready actions, unresolved inputs, guardrails, proof commands, and handoff behavior must remain intact.
- No release or version bump in this iteration.
