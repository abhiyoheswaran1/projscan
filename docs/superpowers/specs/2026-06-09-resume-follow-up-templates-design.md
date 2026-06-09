# Resume Follow-Up Templates Design

## Goal

Show what comes after the current resume step, not only what it unlocks.

`missionControl.resume` now gives the current command, an MCP-native tool call, and resolved unlocked inputs. For multi-step intents such as fuzzy impact analysis, a resumed agent still has to inspect `executionPlan.phases` to learn which follow-up calls each unlocked input leads to. The resume packet should include those downstream templates directly.

## Product Shape

Add optional `followUps` to `missionControl.resume`, copied through `missionControl.handoff.resume` and `missionControl.runbook.resume`.

Each follow-up template includes:

- `id`
- `phaseId`
- `kind`
- `status`
- `label`
- `command` when present
- `tool` and `args` when present
- `blockedBy` when present
- `dependsOn` when present

For Markdown runbooks, render a `Then use:` block in the `## Resume` section:

```text
Then use:
- follow-up-1 (If search returns an exported symbol): projscan impact --symbol <symbol-from-search> --format json
- follow-up-2 (If search returns a file path): projscan impact <file-from-search> --format json
```

These are templates, not ready proof commands; placeholders remain visible until the unlocked inputs are resolved.

## Rules

- Derive follow-ups by walking from cursor `unlocks` to unlocked input steps, then from those input steps to their own `unlocks`.
- Do not duplicate intent routing or invent new follow-up commands.
- Preserve ready-only `commandBlock` and `toolCall` semantics.
- Keep placeholder follow-ups out of `proofCommands`.
- Keep the shape additive and optional for compatibility.

## Testing

- Core test: fuzzy impact resume includes `followUps` for the symbol and file impact templates.
- MCP test: `projscan_start` exposes the same follow-up templates through resume, handoff resume, and runbook resume.
- CLI test: `--include-handoff` runbook renders the `Then use:` follow-up template lines.

## Constraints

- No release, deploy, publish, push, or registry update.
