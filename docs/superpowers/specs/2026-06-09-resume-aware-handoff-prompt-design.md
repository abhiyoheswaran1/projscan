# Resume-Aware Handoff Prompt Design

## Goal

Make the copy/paste handoff prompt use the same resume intelligence as the runbook.

The current `missionControl.resume` object now knows the exact cursor, command block, unlocked input labels, and blocked dependencies. `missionControl.handoffPrompt` still uses an older generic prompt assembled from the primary action. That means the smallest copyable artifact can drift from the actual run cursor.

## Product Shape

Keep the existing `missionControl.handoffPrompt` field, but build it from `missionControl.resume` instead of only the primary action command.

The prompt should include:

- `Resume:` followed by `resume.prompt`.
- `Why:` with the Mission Control rationale.
- `Done when:` with the first success criterion.
- `Needs input:` when unresolved inputs exist.
- `Ready proof:` with the existing ready-proof summary and up to three runnable proof commands.

For ready cursor commands, this makes the prompt name unlocked inputs such as `input-1 (symbol)` and `input-2 (file)`. For blocked cursors, it preserves the direct input instruction and blockers from `resume.prompt`.

## Rules

- Reuse `missionControl.resume`; do not duplicate cursor or unlock selection logic.
- Preserve `missionControl.handoff.resume` as the machine-readable version.
- Keep the field string-only for compatibility with existing MCP and CLI consumers.
- Do not add new commands, flags, publishing steps, or external services.
- Keep proof commands runnable-only.

## Testing

- Core test: fuzzy impact handoff prompt starts with `Resume:` and includes the labeled unlocked inputs from `resume.prompt`.
- MCP test: `projscan_start` exposes the same resume-aware `handoffPrompt`.
- CLI test: when handoff output is requested, the runbook remains the canonical rich artifact and the JSON field remains available through `--format json`.

## Constraints

- Additive behavior in the sense that the existing field remains present and string typed.
- No release, deploy, publish, push, or registry update.
