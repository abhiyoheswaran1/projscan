# Stability

This document defines the projscan public surface - what users and AI agents can depend on across releases, and what may change without notice. It exists so you can build on projscan without surprise.

projscan follows [Semantic Versioning](https://semver.org/). **As of v1.0, breaking changes to the stable surface require a major-version bump (2.0+) and a deprecation cycle (one minor release with a warning, then removal in the next major).** Changes to the **unstable surface** can land in any release.

## Stable surface

These are versioned. Removing or breaking anything in this list requires a deprecation cycle: one minor release with a stderr warning (CLI) or a `deprecated` flag in the tool description (MCP), then removal in the next major version.

### CLI

- **Command names**: `agent-brief`, `analyze`, `apply-fix`, `audit`, `badge`, `bug-hunt`, `ci`, `coupling`, `coverage`, `dataflow`, `dependencies`, `diagram`, `diff`, `doctor`, `evidence-pack`, `explain`, `explain-issue`, `file`, `first-run`, `fix`, `fix-suggest`, `handoff`, `hotspots`, `impact`, `init`, `install-hook`, `mcp`, `memory`, `outdated`, `plugin`, `preflight`, `pr-diff`, `quality-scorecard`, `recipes`, `release-train`, `regression-plan`, `review`, `search`, `semantic-graph`, `session`, `structure`, `taint`, `upgrade`, `watch`, `workplan`, `workspace`, `workspaces`. New commands may be added; existing names will not be renamed or removed.
- **Documented flags** on those commands: `--format`, `--config`, `--changed-only`, `--base-ref`, `--package`, `--limit`, `--cycles-only`, `--high-fan-in`, `--high-fan-out`, `--file`, `--mode`, `--semantic`, `--scope`, `--min-score`, `--save-baseline`, `--against`, `--timeout`, `--aggregate`, `--verbose`, `--quiet`. Documented at `projscan <cmd> --help` or in `docs/GUIDE.md`.
- **Exit codes**: `0` = success / pass, `1` = found issues / failed gate, `2` = invalid usage. We will not flip an existing code's meaning.
- **Output formats**: `console`, `json`, `markdown`, `sarif`, `html`. The `--format` flag will continue to accept these names. Individual commands may support only a subset; unsupported combinations fail with a clear diagnostic rather than falling back to a different renderer. Per-format guarantees:
  - **JSON**: existing report-level `schemaVersion` values remain stable for their report families. The semantic graph contract uses `schemaVersion: 3`; graph-evidence summaries are additive optional fields. Data keys (`issues`, `hotspots`, `coverage`, `nodes`, `edges`, etc.) are stable. New optional fields may be added to objects without a major bump; existing field names and types will not change.
  - **SARIF**: schema is the [SARIF 2.1.0 spec](https://sarifweb.azurewebsites.net/). We are bound by it.
  - **Markdown**: section headings are stable. Whitespace and column widths inside tables are not.
  - **HTML** *(0.16+)*: structural section names (`<h1>`, `<h2>` text) are stable. Inline CSS, layout details, and the footer credit string are unstable; do not parse the rendered HTML for data, use `--format json`.
  - **Console**: see "unstable surface" below.

### MCP server

- **Protocol versions advertised**: `2025-03-26` (current), with backward negotiation for `2024-11-05`. We will continue to support at least one prior protocol version when we move to a newer one.
- **Tool names** (via `tools/list`): `projscan_analyze`, `projscan_doctor`, `projscan_hotspots`, `projscan_explain`, `projscan_file`, `projscan_structure`, `projscan_dependencies`, `projscan_outdated`, `projscan_audit`, `projscan_upgrade`, `projscan_coverage`, `projscan_graph`, `projscan_semantic_graph`, `projscan_coupling`, `projscan_workspaces`, `projscan_pr_diff`, `projscan_review`, `projscan_workplan`, `projscan_bug_hunt`, `projscan_release_train`, `projscan_evidence_pack`, `projscan_regression_plan`, `projscan_agent_brief`, `projscan_quality_scorecard`, `projscan_adoption`, `projscan_fix_suggest`, `projscan_explain_issue`, `projscan_impact`, `projscan_search`, `projscan_session`, `projscan_memory`, `projscan_workspace_graph`, `projscan_apply_fix`, `projscan_taint`, `projscan_dataflow`, `projscan_cost_summary`, `projscan_review_watch`, `projscan_plugin`, `projscan_preflight`. New tools may be added without a major bump; existing names will not be renamed or removed.
- **Input schemas**: documented argument names and types are stable. New optional arguments may be added; existing ones will not change name or type, and required arguments will not become required mid-release-line.
- **Output shapes**: top-level keys returned by each tool are stable. New optional fields may appear; existing fields will not change name, type, or semantic meaning. Pagination cursors are stable across a single major.
- **Review contract intelligence**: `projscan_review.contractChanges` is optional and additive. Entries use stable `kind`, `file`, `symbol`, `before`, `after`, `confidence`, and `why` fields when present.
- **Semantic graph contract**: `projscan_semantic_graph` returns `schemaVersion: 3` with stable `nodes`, `edges`, `metrics`, `truncated`, and `limits` top-level keys. Node ids are stable within a graph build and use `file:`, `function:`, `package:`, and `symbol:` prefixes.
- **Dataflow risk contract**: `projscan_dataflow` returns `available`, `riskCount`, `risks`, `effectiveSources`, and `effectiveSinks`. Optional `include_tests` and `include_broad_file_io` inputs expand the default focused scan. `projscan_review.newDataflowRisks` is additive and currently reports bridge-helper risks not represented by legacy `newTaintFlows`.
- **Preflight release-scale evidence**: `projscan_preflight.evidence.releaseScale` is optional and additive. It appears only when a large before-commit/before-merge change blocks on scale/complexity without concrete health, taint, dataflow, plugin, or supply-chain blockers.
- **Tool manifest**: `dist/tool-manifest.json` is shipped on every release as a GitHub Release asset. External consumers can pin to `releases/download/v<version>/tool-manifest.json` and rely on the schema (`name`, `version`, `mcpProtocolVersion`, `toolCount`, `tools[{name, description, inputSchema}]`).
- **Resource URIs**: `projscan://health`, `projscan://hotspots`, `projscan://structure`, `projscan://session/summary`, `projscan://handoff`, `projscan://risk-now`. Resource payloads are JSON. New optional fields may appear; existing URI names will not be renamed or repurposed in 3.x.

### Configuration

- **`.projscanrc`** schema: `ignore`, `disableRules`, `severityOverrides`, `hotspots.limit`, `hotspots.since`. New keys may be added; existing keys will not change name or type.
- **Environment variables** consulted: `PROJSCAN_PLUGINS_PREVIEW=1` enables local plugin execution. `PROJSCAN_TELEMETRY_HOME`, `PROJSCAN_TELEMETRY_ENDPOINT`, `PROJSCAN_TELEMETRY_DISABLED`, and `PROJSCAN_TELEMETRY_NO_NETWORK` control the explicit opt-in telemetry storage, endpoint, hard-disable, and queue-only modes. Existing names remain stable in 3.x.

### Plugin API

Starting in 2.0, `.projscan-plugins/*.projscan-plugin.json` manifests with
`schemaVersion: 1` are stable for local analyzer and reporter plugins. New
optional manifest fields may be added in 3.x; existing required fields keep
their names and types.

Analyzer plugins export `check(rootPath, files, context?)` and return `Issue[]`. The optional context exposes read-only graph/dataflow helpers and is additive for manifest schema v1. Reporter
plugins export `render(context)` and return a string for supported CLI commands.
Plugin execution is local-only: projscan does not fetch remote plugin code.

### Public API (npm package)

- Exports from `dist/index.js` listed in `src/index.ts` are the public TypeScript API. Anything not re-exported there is internal.
- Re-exported types from `src/types.ts` follow the JSON-output stability rules above.
- `BuiltinLanguageId` is the closed set of bundled language adapters.
  `LanguageId` is extensible and may include plugin-provided language ids.

## Unstable surface

These can change in any release without a major bump.

- **Internal modules** under `src/core/`, `src/analyzers/`, `src/reporters/`, `src/utils/`, `src/cli/`, `src/mcp/` (except where re-exported from `src/index.ts`).
- **Score magnitudes**: the numeric values of `riskScore` (hotspots), `score` (doctor), `instability` (coupling), and similar derived numbers may shift between releases as the underlying formulas evolve. The *ranking* and *direction* of change are stable; absolute thresholds in your CI may need recalibration after upgrades. (Example: 0.11 swapped LOC for AST cyclomatic complexity in `riskScore`, dropping absolute values without changing the ordering.)
- **Console-format whitespace, colors, ASCII drawings, spinner messages, banner art.** Anything visual in the terminal output is for humans; do not parse it. Use `--format json` or `--format sarif` for programmatic use.
- **Cache file format** (`.projscan-cache/`). Bumped on schema changes; old caches are discarded silently and rebuilt. Don't commit, share, or parse.
- **Index cache version, tool-manifest layout details beyond the documented top-level keys, internal vendored wasm grammar versions** (we may upgrade tree-sitter grammars at any time; the *captured* node types and behaviour are what matters).
- **Bundled file paths** under `dist/` not exported via `package.json#exports` or `bin`.

## Deprecation policy

Anything in the **stable surface** marked as deprecated will:

1. Print a deprecation warning to stderr from the CLI / a `deprecated` flag in MCP tool descriptions.
2. Continue to work for at least one full minor release after the warning lands.
3. Be removed in the next major.

The CHANGELOG will always call out deprecations under a dedicated `Deprecated` heading on the release that introduces them.

## How to verify

If you depend on a specific command, flag, MCP tool, or output field, you can lock it down with a contract test in your own repo:

```bash
# CLI exit-code contract
projscan ci --min-score 70; test $? -le 1

# MCP tool inventory contract
curl -fsSL https://github.com/abhiyoheswaran1/projscan/releases/download/v1.0.0/tool-manifest.json \
  | jq '.tools[].name' | grep -q projscan_hotspots
```

If something we documented as stable breaks, that's a bug; please file an issue.
