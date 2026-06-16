# Migrating to projscan 4.0

projscan follows a 1.0 stability contract: within a major version, tools and
CLI commands are **never removed or renamed**. 4.0 is the deliberate major
boundary where a small number of redundant tools are removed in favour of their
supersets. Every removal was **announced as a deprecation in 3.8.0** — a
reversible `[DEPRECATED …]` marker — so no removal here is a surprise.

This is the migration ledger: what was removed in 4.0 and exactly what to use
instead. Both replacements are drop-in for every documented use; in particular,
`projscan_semantic_graph` gained a `query` mode so it now does everything the
old `projscan_graph` did.

## Removed in 4.0

| Removed                                             | Use instead                              | Notes                                                                                                                                                          |
| --------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projscan_explain` (MCP) / `projscan explain` (CLI) | `projscan_file` / `projscan file`        | `file` is a strict superset: same purpose / imports / exports, **plus** churn, risk, ownership, and related-health signal.                                     |
| `projscan_graph` (MCP)                              | `projscan_semantic_graph` with a `query` | `semantic_graph` gained a targeted `query` mode in 4.0 that subsumes graph's queries (see below). With no `query` it still returns the full v3 semantic graph. |

## Migrating `projscan_graph` → `projscan_semantic_graph`

The old `projscan_graph` took `{ direction, file?, symbol? }` at the top level.
The same query now nests under `query`:

| Old `projscan_graph`                                  | New `projscan_semantic_graph`                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| `{ direction: "imports", file: "src/a.ts" }`          | `{ query: { direction: "imports", file: "src/a.ts" } }`          |
| `{ direction: "exports", file: "src/a.ts" }`          | `{ query: { direction: "exports", file: "src/a.ts" } }`          |
| `{ direction: "importers", file: "src/a.ts" }`        | `{ query: { direction: "importers", file: "src/a.ts" } }`        |
| `{ direction: "symbol_defs", symbol: "foo" }`         | `{ query: { direction: "symbol_defs", symbol: "foo" } }`         |
| `{ direction: "package_importers", symbol: "chalk" }` | `{ query: { direction: "package_importers", symbol: "chalk" } }` |

The result shapes (`{ imports }`, `{ exports }`, `{ importers }`, `{ definedIn }`,
`{ importers }`) are unchanged. `limit` is still supported (inside `query`).
Calling `projscan_semantic_graph` with **no** `query` returns the full semantic
graph exactly as before.

## Migrating `projscan_explain` → `projscan_file`

`projscan_file` takes the same `{ file }` argument and returns a superset of the
old explanation (purpose / imports / exports) plus risk, ownership, churn, CC,
and coupling. No call-site change beyond the tool/command name.

## Scope note

The broader tool-surface consolidation (routing the long tail behind
`projscan_route`) is deliberately **not** part of 4.0. Those tools each produce
distinct artifacts; consolidating them is a product decision that should be
informed by real usage signal, not assumed. Any future removal will first appear
as a deprecation here for a full window — the same deprecate-before-remove
discipline 4.0 followed.
