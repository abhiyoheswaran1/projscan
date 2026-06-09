# Execution Step Dependencies Design

## Goal

Make Mission Control's execution plan easier for agents to follow by adding explicit dependencies between ready steps, blocked inputs, and follow-up actions.

## Product Shape

The existing `missionControl.executionPlan` already splits the work into phases. The missing piece is dependency clarity: a blocked follow-up says `projscan impact --symbol <symbol-from-search>`, but an agent still has to infer that the search step provides the symbol.

Add step-level metadata:

- `dependsOn`: step ids that should happen before this step.
- `blockedBy`: input step ids currently blocking this step.
- `unlocks`: step ids or input ids that this step can unlock.

## Rules

- Ready command steps unlock unresolved input steps when the plan has placeholder follow-ups.
- Input steps depend on the first ready command and unlock follow-up steps that use their placeholder.
- Follow-up steps depend on the first ready command plus the matching input step(s).
- Follow-up steps with placeholders are `blocked` and list `blockedBy`.
- Plans without unresolved inputs keep dependency fields absent unless a step truly unlocks another step.

## Testing

- Core test: fuzzy impact intent marks the search step as unlocking `input-1` and `input-2`; symbol/file follow-ups are blocked by their matching input.
- MCP test: returned JSON exposes the same dependency fields.
- CLI test: the Execution Plan prints blocked follow-ups with their blockers.

## Constraints

- Additive JSON only.
- Stable existing ids remain unchanged.
- No command behavior changes.
- No release or push.
