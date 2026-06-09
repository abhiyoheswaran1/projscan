# Runbook Proof Queue Design

## Problem

Mission Control now exposes `remainingProofItems`, a complete ordered proof queue with optional MCP calls per item. The Markdown runbook still renders two separate sections: `Remaining proof` and `MCP proof calls`. That makes humans and agents mentally merge two lists, and it can hide that a CLI-only proof command is still required.

## Goal

Make the runbook proof section read like one ordered queue. Each remaining proof item should show the CLI command and, when available, the matching MCP call. CLI-only proof should be explicitly marked.

## Approaches

1. Add a `Proof queue` block derived from `resume.remainingProofItems`.
   This is the recommended approach because it uses the complete item model and preserves the older sections for compatibility.
2. Replace `Remaining proof` and `MCP proof calls` with the new queue.
   This is cleaner long term, but it risks disrupting existing tests, docs, or human habits that scan for those headings.
3. Only add CLI-only proof under `MCP proof calls`.
   This is misleading because those entries are not MCP-callable.

## Design

When `resume.remainingProofItems` is present, render:

- `Proof queue:`
- One bullet per proof item.
- Include `stepId`, command, and either `MCP: <tool> <args>` or `CLI only`.

Keep the existing `Remaining proof` and `MCP proof calls` sections in this slice. The new queue becomes the preferred readable path, while existing consumers and snapshots remain stable.

## Testing

- Core runbook test: seeded session handoff intent renders `Proof queue`, includes an MCP-mapped proof item, and marks `projscan handoff` as `CLI only`.
- CLI console test: `--include-handoff` output renders the same proof queue for a session-backed handoff.
- MCP start test: runbook Markdown returned over MCP includes the same queue.

## Documentation

Update README, guide, and changelog to document the runbook `Proof queue` as the preferred human-readable proof sequence.
