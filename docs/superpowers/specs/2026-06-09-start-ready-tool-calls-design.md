# Start Ready Tool Calls Design

## Context

`projscan start --next-tool-call` gives an MCP agent the current cursor call. `missionControl.resume.remainingProofToolCalls` and `missionControl.handoff.readyProof.toolCalls` already carry the MCP-callable proof queue. A developer or agent who wants every currently runnable MCP call still has to combine the current cursor with the remaining proof queue.

## Goal

Add `projscan start --ready-tool-calls` so the CLI can print the ordered MCP-callable queue for the current mission.

## Recommended Approach

Add a console-only shortcut that prints a compact JSON array:

1. The current cursor tool call from `missionControl.resume.toolCall` or the execution cursor.
2. Remaining proof tool calls from `missionControl.handoff.readyProof.toolCalls`.

Each array item should contain only the callable MCP shape:

```json
{ "tool": "projscan_search", "args": { "query": "auth token loader" } }
```

This keeps the output easy to parse and aligned with `--next-tool-call`. Step ids and CLI commands stay available in the full JSON report, runbook, and proof queue.

## Alternatives Considered

Print JSON Lines. That helps shell streaming, but developers then need line processing before passing the queue to JSON-aware tooling.

Add a new field to `StartReport`. The report already exposes the ingredients through `resume.toolCall` and `handoff.readyProof.toolCalls`, so adding a derived field would expand the stable JSON contract for a CLI convenience.

Print proof tool calls only. That would duplicate `readyProof.toolCalls` and still leave agents to fetch the current cursor call separately.

## Behavior

`--ready-tool-calls` applies only in console mode. With `--format json`, projscan should keep returning the full start report.

Shortcut precedence should stay narrow-to-broad:

1. `--next-command`
2. `--next-tool-call`
3. `--ready-tool-calls`
4. `--proof-commands`
5. `--checklist`
6. `--runbook`
7. `--shortcuts`
8. `--handoff-prompt`

If no MCP-callable steps are available, the command should print a concise stderr message and exit 1.

## Testing

- CLI shortcut test: fuzzy impact intent prints a compact JSON array whose first item is `projscan_search`, includes proof calls such as `projscan_preflight` and `projscan_understand`, omits `stepId` / `command`, and omits full report headings.
- CLI JSON test: `--ready-tool-calls --format json` still emits the full report with `resume.toolCall` and `handoff.readyProof.toolCalls`.
- Shortcut index test: `--shortcuts` lists `projscan start --ready-tool-calls --intent '<goal>'`.

## Docs And Screenshots

Update the README shortcut list and options table, the guide shortcut paragraph, the changelog, and the Playwright demo HTML. Regenerate README screenshots and inspect the changed PNGs.

## Self-Review

- No placeholders remain.
- The design is CLI-only and does not expand MCP or JSON report contracts.
- The queue has deterministic order: current cursor first, proof calls after.
- CLI-only proof remains visible in runbooks and proof queues, but it is excluded from this MCP-only shortcut.
