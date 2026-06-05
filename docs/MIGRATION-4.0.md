# Migrating to projscan 4.0

projscan follows a 1.0 stability contract: within a major version, tools and
CLI commands are **never removed or renamed**. The 4.0 release consolidates the
tool surface — a small number of redundant tools are removed in favour of their
supersets. To give agents and humans a no-surprise upgrade, every removal is
**announced as a deprecation one or more minor releases ahead** of 4.0.

This document is the running ledger of what is deprecated and what to use
instead. Deprecations are **reversible** — if a tool proves valuable during its
deprecation window, it stays. Nothing here is removed before 4.0.

## How a deprecation shows up

- **MCP**: the tool still exists and still works. Its `description` is prefixed
  with `[DEPRECATED since X, removed in 4.0 — use Y]`, and the tool definition
  carries a structured `deprecated: { since, replacedBy, note }` field so a
  client can detect it programmatically.
- **CLI**: the command still runs and exits `0`. It prints a one-line
  deprecation notice to **stderr** (never stdout, so piped/JSON output is
  unaffected) pointing at the replacement.

## Deprecated in 3.8.0 → removed in 4.0

| Deprecated | Replacement | Why |
| --- | --- | --- |
| `projscan_explain` (MCP) / `projscan explain` (CLI) | `projscan_file` / `projscan file` | `file` is a strict superset: same purpose / imports / exports, **plus** churn, risk, ownership, and related-health signal. |
| `projscan_graph` (MCP) | `projscan_semantic_graph` | `semantic_graph` is the stable v3 successor — the same file/function/package/symbol nodes and edges, behind a versioned, supported contract. |

> The broader tool-surface consolidation (routing the long tail behind
> `projscan_route`) is deliberately **not** part of this pass. Those tools each
> produce distinct artifacts; consolidating them is a product decision that
> should be informed by real usage signal, not assumed. They will only be
> deprecated here once that signal exists — and only after appearing in this
> table for a full deprecation window.

## What you should do now

Nothing is forced in 3.x. When convenient:

- Replace `projscan_explain` calls with `projscan_file` (richer result, same shape for the shared fields).
- Replace `projscan_graph` calls with `projscan_semantic_graph`.

Both replacements are available today and fully supported.
