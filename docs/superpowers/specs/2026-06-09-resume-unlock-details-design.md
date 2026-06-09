# Resume Unlock Details Design

## Goal

Make the resume artifact explain what a ready command unlocks.

`missionControl.resume` currently gives a command block and prompt, but when the cursor unlocks later inputs or follow-ups it only repeats step ids. A resumed agent still has to inspect the execution plan to learn what `input-1` means. Add resolved unlock details directly to the resume object.

## Product Shape

Add optional arrays to `missionControl.resume`, copied through handoff and runbook:

- `unlocks`: resolved step references for cursor `unlocks`.
- `blockedBy`: resolved step references for cursor `blockedBy`.

Each reference includes:

- `id`
- `phaseId`
- `kind`
- `status`
- `label`
- `instruction` when present
- `command` when present

Render the runbook `## Resume` section with:

- `After running, resolve:` for unlocked input steps.
- `Blocked by:` for blocked cursor dependencies.

## Rules

- Resolve references from `executionPlan.phases`; do not duplicate selection logic.
- Preserve the existing `commandBlock` behavior.
- If a cursor unlock id cannot be resolved, omit it from detailed references but keep the raw cursor id unchanged.
- Do not include placeholder commands in `commandBlock`.

## Testing

- Core test: fuzzy impact intent resume includes `unlocks` for `input-1` and `input-2`, including labels and instructions.
- MCP test: `projscan_start` exposes the same detailed unlocks.
- CLI test: `Agent Runbook` prints the unlocked inputs under `## Resume`.

## Constraints

- Additive JSON only.
- No new commands or flags.
- No release, publish, push, or registry update.
