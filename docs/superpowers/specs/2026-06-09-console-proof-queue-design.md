# Console Proof Queue Design

## Problem

`projscan start` now builds a resume-aware proof queue with MCP call metadata and CLI-only proof items, but the default console output still shows only the first few raw proof commands under `Ready Proof`.

That makes the richer proof guidance easy to miss for developers who use the normal terminal flow and do not pass `--include-handoff` or `--format json`.

## Goals

- Show the ordered proof queue in normal console output when structured proof items are available.
- Make MCP-callable and CLI-only proof steps visible without requiring the runbook.
- Preserve the existing `Ready Proof` summary and command list so current readers and tests keep working.
- Keep the change renderer-only by reusing `missionControl.handoff.readyProof.items`.

## Non-Goals

- Changing the `start` JSON schema.
- Adding new proof commands.
- Expanding the console output with blocked follow-up templates.

## Design

When `missionControl.handoff.readyProof.items` is present, `printMissionControl` appends a compact `Proof Queue` subsection after the existing `Ready Proof` commands:

```text
Ready Proof
Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.
- projscan agent-brief --intent next_agent --format json
- projscan preflight --mode before_edit --format json
- projscan understand --view verify --format json
Proof Queue
- proof-1: projscan agent-brief --intent next_agent --format json (MCP: projscan_agent_brief {"intent":"next_agent"})
- proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})
- proof-6: projscan handoff (CLI only)
```

The console queue is intentionally plain text, while the Markdown runbook keeps backticks.

## Test Plan

- Extend the start console test for handoff intents to assert:
  - `Proof Queue` appears without `--include-handoff`.
  - an MCP-backed proof item shows its tool and args.
  - `projscan handoff` is shown as `CLI only`.
  - the existing placeholder exclusion behavior remains intact.
