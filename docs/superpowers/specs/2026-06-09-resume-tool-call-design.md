# Resume Tool Call Design

## Goal

Make `missionControl.resume` directly callable by MCP agents, not only by shell-oriented humans.

The current resume artifact includes a runnable command block and prompt. That is useful for humans and CLI-driven agents, but MCP agents still have to inspect `executionPlan.phases` or `missionControl.actionPlan` to recover the exact tool name and arguments for the current cursor. The smallest resume packet should carry both forms when both are available.

## Product Shape

Add an optional `toolCall` to `missionControl.resume`, copied through `missionControl.handoff.resume` and `missionControl.runbook.resume`.

`toolCall` includes:

- `tool`: the MCP tool name from the current cursor step.
- `args`: the ready argument object when available.

For Markdown runbooks, render an `MCP call:` line in the `## Resume` section:

```text
MCP call: projscan_search {"query":"auth token loader"}
```

For cursor steps that are input, criterion, or proof-only commands without a known MCP tool, omit `toolCall` and keep the existing command/instruction behavior unchanged.

## Rules

- Resolve `toolCall` from the selected execution cursor step; do not re-route the intent.
- Preserve `commandBlock` for CLI users.
- Only include `toolCall` when the tool name is known and arguments are ready.
- Do not introduce a new CLI flag or MCP endpoint.
- Keep the shape additive and optional for compatibility.

## Testing

- Core test: fuzzy impact resume includes `toolCall: { tool: "projscan_search", args: { query: "auth token loader" } }`.
- MCP test: `projscan_start` exposes the same tool call through `missionControl.resume`, handoff resume, and runbook resume.
- CLI test: `--include-handoff` runbook renders the `MCP call:` line in the resume section.

## Constraints

- No release, deploy, publish, push, or registry update.
