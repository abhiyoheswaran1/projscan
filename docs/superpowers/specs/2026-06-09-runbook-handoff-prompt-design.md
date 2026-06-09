# Runbook Handoff Prompt Design

## Problem

`missionControl.handoffPrompt` gives agents a compact, resume-aware handoff that starts at the current cursor and includes labeled unlocks, blockers, done criteria, and remaining proof. The default console also prints that value as `Handoff Prompt`.

The full Markdown runbook still only includes the shorter `Prompt:` line inside `## Resume`. If an agent or human copies only the runbook, they lose the richer one-line handoff that the JSON and default console already expose.

## Goal

Render the existing `missionControl.handoffPrompt` value in Markdown runbooks as a dedicated `## Handoff Prompt` section. Place it after `## Resume` and before `## Ready Commands`, so it sits next to the resume block and before operational command lists.

## Non-Goals

- Do not change the handoff prompt wording or composition.
- Do not add a new top-level JSON field.
- Do not add a new `missionControl.runbook` field.
- Do not change release, publish, deployment, or registry behavior.

## Design

Move `whyNow` calculation before runbook construction in `buildMissionControl`, then compute one `handoffPrompt` value with the existing `missionHandoffPrompt(...)` helper. Pass that string into `buildMissionRunbook`, then into `renderMissionRunbookMarkdown`.

`renderMissionRunbookMarkdown` will insert:

```markdown
## Handoff Prompt
<existing missionControl.handoffPrompt>
```

between the rendered resume block and `## Ready Commands`.

The returned `missionControl.handoffPrompt` must use the same string passed into the Markdown renderer. This avoids duplicate formatting logic and keeps JSON, console, MCP, and runbook handoffs aligned.

## Tests

- Core Mission Control runbook Markdown includes `## Handoff Prompt`, contains `missionControl.handoffPrompt`, and places it after `## Resume` and before `## Ready Commands`.
- CLI `start --include-handoff` output includes the new runbook section and the expected resume-aware prompt text.
- MCP `projscan_start` runbook Markdown includes the new section and the same `missionControl.handoffPrompt` string.

## Self-Review

- No placeholders remain.
- Scope is limited to Markdown runbook rendering.
- The JSON shape remains stable because only the existing `runbook.markdown` string changes.
- The implementation reuses the existing handoff prompt helper instead of introducing parallel wording.
