# Cursor Tool Call Design

## Problem

`missionControl.executionPlan.cursor` is the canonical pointer for "what to do next", but it currently carries only CLI-oriented fields such as `command`, `instruction`, blockers, and unlocks.

MCP agents can find the same callable metadata through `missionControl.resume.toolCall`, but that requires cross-referencing a second object even when the agent is already following the cursor.

## Goals

- Add `tool` and `args` to `missionControl.executionPlan.cursor` when the selected cursor step has an MCP tool call.
- Preserve existing cursor fields and command strings.
- Keep `missionControl.resume.toolCall` for backward compatibility and convenience.
- Render the cursor MCP call in the console `Run Cursor` section and Markdown runbook `Current Cursor` section when available.

## Non-Goals

- Removing `missionControl.resume.toolCall`.
- Adding MCP metadata to blocked inputs or done criteria when no tool exists.
- Changing cursor selection order.
- Changing any CLI command strings.

## Design

`executionCursor` should copy `tool` and `args` from the selected execution step:

```json
{
  "phaseId": "ready_now",
  "stepId": "ready-1",
  "kind": "tool",
  "command": "projscan workplan --mode before_edit --format json",
  "tool": "projscan_workplan",
  "args": { "mode": "before_edit" }
}
```

Because proof execution steps now include MCP metadata when possible, proof cursors also become callable. Cursor references in handoff and runbook payloads already point at the same cursor object, so they inherit the fields automatically.

Console output adds one line when the cursor is callable:

```text
Run Cursor
next: ready-1 in Ready Commands
command: projscan workplan --mode before_edit --format json
MCP call: projscan_workplan {"mode":"before_edit"}
```

Runbooks add the same information under `## Current Cursor`:

```text
- MCP call: projscan_workplan {"mode":"before_edit"}
```

## Test Plan

- Extend core start tests to assert cursor `tool` / `args` for a ready search cursor and a proof cursor.
- Extend MCP start tests to assert the cursor is directly callable and still equals handoff/runbook current-step references.
- Extend CLI console/runbook tests to assert the cursor MCP call is rendered.
- Run focused start suites, build, lint, full tests, and the usual stability/security/corpus/smoke gates.
