# Stability

This document defines the projscan public surface - what users and AI agents can depend on across releases, and what may change without notice. It exists so you can build on projscan without surprise.

projscan follows [Semantic Versioning](https://semver.org/). Breaking changes to the **stable surface** require a major-version bump. Changes to the **unstable surface** can land in any release.

## Stable surface

These are versioned. We will not break them without a major bump. After the project hits v1.0, removing or breaking anything in this list requires a deprecation cycle (one minor release with a warning, then removal in the next major).

### CLI

- **Command names**: `analyze`, `doctor`, `ci`, `hotspots`, `coupling`, `pr-diff`, `review`, `dependencies`, `outdated`, `audit`, `coverage`, `search`, `structure`, `explain`, `explain-issue`, `fix-suggest`, `badge`, `diff`, `workspaces`, `mcp`. New commands may be added; existing names will not be renamed or removed.
- **Documented flags** on those commands: `--format`, `--config`, `--changed-only`, `--base-ref`, `--package`, `--limit`, `--cycles-only`, `--high-fan-in`, `--high-fan-out`, `--file`, `--mode`, `--semantic`, `--scope`, `--min-score`, `--save-baseline`, `--against`, `--timeout`, `--aggregate`, `--verbose`, `--quiet`. Documented at `projscan <cmd> --help` or in `docs/GUIDE.md`.
- **Exit codes**: `0` = success / pass, `1` = found issues / failed gate, `2` = invalid usage. We will not flip an existing code's meaning.
- **Output formats**: `console`, `json`, `markdown`, `sarif`. The `--format` flag will continue to accept these names. Per-format guarantees:
  - **JSON**: top-level keys (`issues`, `hotspots`, `coverage`, etc.) are stable. New optional fields may be added to objects without a major bump; existing field names and types will not change.
  - **SARIF**: schema is the [SARIF 2.1.0 spec](https://sarifweb.azurewebsites.net/). We are bound by it.
  - **Markdown**: section headings are stable. Whitespace and column widths inside tables are not.
  - **Console**: see "unstable surface" below.

### MCP server

- **Protocol versions advertised**: `2025-03-26` (current), with backward negotiation for `2024-11-05`. We will continue to support at least one prior protocol version when we move to a newer one.
- **Tool names** (via `tools/list`): `projscan_analyze`, `projscan_doctor`, `projscan_hotspots`, `projscan_search`, `projscan_graph`, `projscan_file`, `projscan_audit`, `projscan_outdated`, `projscan_dependencies`, `projscan_upgrade`, `projscan_coverage`, `projscan_structure`, `projscan_coupling`, `projscan_pr_diff`, `projscan_workspaces`, `projscan_review`, `projscan_fix_suggest`, `projscan_explain_issue`. New tools may be added without a major bump; existing names will not be renamed or removed.
- **Input schemas**: documented argument names and types are stable. New optional arguments may be added; existing ones will not change name or type, and required arguments will not become required mid-release-line.
- **Output shapes**: top-level keys returned by each tool are stable. New optional fields may appear; existing fields will not change name, type, or semantic meaning. Pagination cursors are stable across a single major.
- **Tool manifest**: `dist/tool-manifest.json` is shipped on every release as a GitHub Release asset. External consumers can pin to `releases/download/v<version>/tool-manifest.json` and rely on the schema (`name`, `version`, `mcpProtocolVersion`, `toolCount`, `tools[{name, description, inputSchema}]`).

### Configuration

- **`.projscanrc`** schema: `ignore`, `disableRules`, `severityOverrides`, `hotspots.limit`, `hotspots.since`. New keys may be added; existing keys will not change name or type.
- **Environment variables** consulted: none currently advertised as stable. (`PROJSCAN_TELEMETRY` was removed when telemetry was dropped.)

### Public API (npm package)

- Exports from `dist/index.js` listed in `src/index.ts` are the public TypeScript API. Anything not re-exported there is internal.
- Re-exported types from `src/types.ts` follow the JSON-output stability rules above.

## Unstable surface

These can change in any release without a major bump.

- **Internal modules** under `src/core/`, `src/analyzers/`, `src/reporters/`, `src/utils/`, `src/cli/`, `src/mcp/` (except where re-exported from `src/index.ts`).
- **Score magnitudes**: the numeric values of `riskScore` (hotspots), `score` (doctor), `instability` (coupling), and similar derived numbers may shift between releases as the underlying formulas evolve. The *ranking* and *direction* of change are stable; absolute thresholds in your CI may need recalibration after upgrades. (Example: 0.11 swapped LOC for AST cyclomatic complexity in `riskScore`, dropping absolute values without changing the ordering.)
- **Console-format whitespace, colors, ASCII drawings, spinner messages, banner art.** Anything visual in the terminal output is for humans; do not parse it. Use `--format json` or `--format sarif` for programmatic use.
- **Cache file format** (`.projscan-cache/`). Bumped on schema changes; old caches are discarded silently and rebuilt. Don't commit, share, or parse.
- **Index cache version, tool-manifest layout details beyond the documented top-level keys, internal vendored wasm grammar versions** (we may upgrade tree-sitter grammars at any time; the *captured* node types and behaviour are what matters).
- **Bundled file paths** under `dist/` not exported via `package.json#exports` or `bin`.

## Deprecation policy

Once v1.0 ships, anything in the **stable surface** marked as deprecated will:

1. Print a deprecation warning to stderr from the CLI / a `deprecated` flag in MCP tool descriptions.
2. Continue to work for at least one full minor release after the warning lands.
3. Be removed in the next major.

Pre-v1.0, deprecations may move faster; the CHANGELOG will always call them out.

## How to verify

If you depend on a specific command, flag, MCP tool, or output field, you can lock it down with a contract test in your own repo:

```bash
# CLI exit-code contract
projscan ci --min-score 70; test $? -le 1

# MCP tool inventory contract
curl -fsSL https://github.com/abhiyoheswaran1/projscan/releases/download/v0.11.0/tool-manifest.json \
  | jq '.tools[].name' | grep -q projscan_hotspots
```

If something we documented as stable breaks, that's a bug; please file an issue.
