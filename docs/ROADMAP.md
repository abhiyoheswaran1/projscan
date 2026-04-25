# ProjScan Roadmap

Planned features and improvements. Community suggestions welcome - open an issue or PR.

---

## Big bet: "Agent-First"

The tool is repositioning. The MCP server is the product; the CLI is a consumer of the same primitives.

## Planned

The original 0.11 → 0.15 themed sequence shipped together as **0.11.0** (a six-month bundle). What's left is the deferred backlog below. The next versioned release will be picked from it based on user issues + PR feedback, since the per-release feedback loop the original plan envisioned was traded away in the bundle.

### Backlog / under consideration

- **Sub-file embeddings** - chunk large files (per-export, per-function, per-class) so semantic search points at specific code blocks. Highest-value remaining item; cleanest follow-on to 0.11's CC + coupling work.
- **Registry-aware upgrade preview** - `projscan upgrade <pkg>` optionally fetches `latest` from npm registry; Python equivalent reads pip/poetry metadata.
- **Fix generation via the driving agent** - `projscan fix` today is rule-based; extend with `projscan_fix_suggest` that returns a prompt the agent can act on (agent-native fixes without embedding an LLM in projscan itself).
- **SAST-style security rules** - extend securityCheck with AST-based path-traversal, SQL-injection, XSS rules. Careful - do not turn into a Snyk competitor.
- **Plugin API** - third-party analyzers and reporters. Multi-language + monorepo are now stable, so this is unblocked.
- **Multi-repo dashboard / SaaS** - upload baselines, team health trends, org-wide hotspots. 0.11 telemetry is the prerequisite; needs adoption data before scoping.
- **Per-package dependencies/outdated/audit** - workspace-aware lockfile parsing. The `--package` flag covers everything *except* these three commands today.
- **Third language adapter** - Rust or Java, riding the same `LanguageAdapter` interface that proved out for Python (0.10) and Go (0.11).
- **Per-function CC** instead of file-level. Useful but needs per-function storage in the graph + cache; deferred until requested.
- **Cycle promotion to issues** - lift `projscan_coupling`'s circular-import findings into `projscan_doctor`'s issue list. Trivial after some real-world cycle counts come in via telemetry.
- **HTML report export** - standalone HTML health report.
- **Watch mode** - re-scan on file changes.

---

## Recently Shipped

### v0.11.x - "Six-month bundle" (Signal Quality + PR Native + Monorepo + Observability + Go)
- **Signal Quality.** AST cyclomatic complexity replaces LOC in the hotspot risk score (per-file McCabe via Babel walker for JS/TS, tree-sitter walker for Python + Go). New `projscan_coupling` MCP tool + CLI command surfaces fan-in / fan-out / instability and Tarjan-detected import cycles. `projscan_file` enriched with CC + fan-in/fan-out.
- **PR Native.** New `projscan_pr_diff` returns the structural diff between two refs (exports + imports + callsites + ΔCC + Δfan-in). Stands up a temporary git worktree at the base ref. Heuristic export-rename detection (max of normalized Levenshtein and shared-affix; threshold 0.5) reclassifies +/- pairs as `~` renames.
- **Monorepo.** Detection for npm/yarn workspaces (`package.json#workspaces`), pnpm (`pnpm-workspace.yaml`), Lerna (`lerna.json#packages`), Nx (`workspaceLayout` + `project.json` scan + legacy `workspace.json#projects`). Turbo as marker (it doesn't declare workspaces). New `projscan_workspaces` tool. `--package <name>` scope on hotspots, coupling, analyze, doctor, structure, coverage, search, pr-diff. Cross-package graph edges flagged in coupling output.
- **Observability.** Opt-in privacy-preserving telemetry (off by default; `.projscanrc` + `PROJSCAN_TELEMETRY` env override + kill-switch). Records only tool name, duration, success, version, timestamp. Local JSONL sink. New `projscan_telemetry` MCP tool with `aggregate: true` arg returns per-tool histograms (count, p50/p95/p99, error rate). `projscan telemetry --aggregate` CLI mirror.
- **Go.** `goAdapter` mirrors the Python adapter pattern. Tree-sitter-go (~210 KB vendored wasm). Module-path resolution via `go.mod`. Capitalization-rule export visibility. Full pipeline parity with JS/TS and Python.
- **Cache v2 → v3** (CC persisted per file; v2 caches discarded on first 0.11 run). MCP tool count: 13 → 17. Runtime deps: 8 → 9. Vendored wasm: ~640 KB → ~850 KB.
- **Bundling tradeoff:** loses the original 0.14 telemetry → 0.15 language-pick feedback loop. Future "what next?" decisions lean on issues + PR feedback until enough 0.11 users opt into telemetry.
- 659 tests passing (+61 over 0.10).

### v0.10.x - "Beyond JS"
- Python is a first-class language. `LanguageAdapter` interface; tree-sitter-python (wasm, offline); Python parser + imports + exports + resolver; package-root detection from pyproject.toml / setup.py / setup.cfg / `__init__.py` walk.
- Four new Python analyzers: `pythonTestCheck`, `pythonLinterCheck`, `pythonDependencyRiskCheck`, `pythonUnusedDependencyCheck`.
- `DEFAULT_IGNORE` extended with Python noise dirs (venv, __pycache__, .tox, .pytest_cache, .mypy_cache, .ruff_cache, .eggs, *.egg-info).
- `deadCodeCheck` widened; `fileInspector` graph-aware; `indexCache` v2; `searchIndex` filters Python keywords.
- +2 runtime deps (web-tree-sitter + tree-sitter-python wasm, ~640 KB vendored). Zero new network activity.

### v0.9.x
- **True Semantic Search (opt-in)** theme
- `@xenova/transformers` as optional peer dep - default install unchanged
- File-level embeddings via `Xenova/all-MiniLM-L6-v2` (384-dim, ~25MB quantized)
- Disk cache keyed by model + mtime + content hash
- Three search modes: `lexical` (default), `semantic`, `hybrid` (RRF)
- Bug fixes: progress-emitter context isolation via AsyncLocalStorage; stderr logging when semantic build aborts

### v0.8.x
- **Streaming & Pagination** theme
- MCP protocol 2025-03-26 (with 2024-11-05 backward negotiation)
- Cursor-based pagination on `projscan_hotspots`, `projscan_search`, `projscan_audit`, `projscan_outdated`, `projscan_coverage`
- Progress notifications on long-running tools (agents that pass a `progressToken` get per-milestone updates)
- Opt-in response chunking via `stream: true` - splits large arrays into multiple MCP content blocks
- Bug fixes: `--changed-only` now reports drop count; hotspot path boundaries extended

### v0.7.x
- **Smart Search** theme. BM25-ranked content + symbols + path.
- `src/core/searchIndex.ts` + `projscan search <query>` + upgraded `projscan_search` MCP tool
- camelCase / snake_case query expansion, light stemming, stopword + TS-keyword filtering
- Bug fixes: MCP budget sidecar on arrays, hotspot ↔ issue linking, dead-code cleanup
- Dogfooded projscan on itself - own doctor score is now A/100

### v0.6.x
- **Agent-First** theme. MCP server becomes the primary product.
- Real AST parsing (`@babel/parser`) replacing regex in the import/export extractor
- `codeGraph` core primitive - bidirectional file×symbol graph
- Incremental `.projscan-cache/` (mtime-keyed) - agent queries become millisecond-fast on warm cache
- MCP context-token budgeter - `max_tokens` arg on any tool, automatic truncation
- New MCP tools: `projscan_graph` (structural queries), `projscan_search` (symbols/files/content)

### v0.5.x
- **Deeper Signal** theme
  - `projscan coverage` - parses lcov / coverage-final / coverage-summary, joins with hotspots, surfaces "scariest untested files"
  - Coverage-weighted hotspot risk - uncovered churning files bubble up
  - Dead-code analyzer - flags source files whose exports nothing imports; respects package.json public entries
  - Import-graph extractor upgraded - captures `import type`, re-exports, and dynamic `import()`

### v0.4.x
- **Dependency Health** theme
  - `projscan outdated` - offline declared-vs-installed drift check
  - `projscan audit` - wraps `npm audit --json`; SARIF-ready; joins findings to `package.json`
  - `projscan upgrade <pkg>` - offline upgrade preview: semver drift, local CHANGELOG breaking-change markers, importer list
  - Unused-dependency analyzer - anchored to exact line in `package.json` for GitHub Code Scanning PR annotations
  - `dep-risk-*` issues gain `package.json` locations

### v0.3.x
- **SARIF output** (`--format sarif`) - feeds GitHub Code Scanning directly; file/line locations on security findings
- **`--changed-only` mode** - scope `analyze` / `doctor` / `ci` to files changed vs a base ref (PR-diff semantics)
- **`.projscanrc` config** - thresholds, rule disables, severity overrides, ignore globs; supports `.projscanrc.json`, `.projscanrc`, or `package.json#projscan`
- **GitHub Action** (`action.yml`) - one-step install → run → upload SARIF to Code Scanning

### v0.2.x
- **Hotspot analysis** (`projscan hotspots`) - git churn × complexity × issue density to rank the files most worth fixing first
- **MCP server** (`projscan mcp`) - exposes projscan as a Model Context Protocol server so AI coding agents (Claude Code, Cursor, Windsurf) can ground their work in project health

### v0.1.x
- Health score and letter grades (A–F)
- Security scanner (secrets, .env files, private keys)
- CI health gate (`projscan ci`)
- Baseline tracking (`projscan diff`)
- Auto-fix system (ESLint, Prettier, Vitest, EditorConfig)
- Architecture diagrams
- File explanation engine
- Health badge generation
