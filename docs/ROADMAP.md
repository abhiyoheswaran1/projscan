# ProjScan Roadmap

Planned features and improvements. Community suggestions welcome - open an issue or PR.

---

## Big bet: "Agent-First"

The tool is repositioning. The MCP server is the product; the CLI is a consumer of the same primitives.

## Planned

The next release continues the path toward a stable v1.0 contract. Themes carrying over:

- **Performance budget.** Run the bench suite (`npm run bench`) on a large reference repo (e.g. TypeScript or vscode) and publish the numbers in the README so users know what to expect at scale.
- **Workspace-aware `dependencies` and `audit`.** `outdated` now enumerates per-package; `dependencies` (unused-dependency check) and `audit` need the same treatment. `audit` is partially covered today because `npm audit` reads the root lockfile.

### Path to v1.0

v1.0 ships when:

- The codebase has gone through one release cycle proving the [stability contract](STABILITY.md) holds - no breaking change to the stable surface across that window.
- At least one external contributor has merged a non-trivial PR (validates the `LanguageAdapter` / analyzer / reporter contribution paths in practice).
- We commit publicly: no breaking change to the stable surface without a major bump.

### Backlog / under consideration

Picked up if user demand surfaces.

- **Sub-file embeddings** - chunk large files (per-export, per-function, per-class) so semantic search points at specific code blocks.
- **Registry-aware upgrade preview** - `projscan upgrade <pkg>` optionally fetches `latest` from npm registry; Python equivalent reads pip/poetry metadata.
- **Fix generation via the driving agent** - `projscan fix` today is rule-based; extend with `projscan_fix_suggest` that returns a prompt the agent can act on (agent-native fixes without embedding an LLM in projscan itself).
- **SAST-style security rules** - extend securityCheck with AST-based path-traversal, SQL-injection, XSS rules.
- **Plugin API** - third-party analyzers and reporters.
- **Multi-repo dashboard / SaaS** - upload baselines, team health trends, org-wide hotspots.
- **Per-function CC** instead of file-level. Needs per-function storage in the graph + cache.
- **Cycle promotion to issues** - lift `projscan_coupling`'s circular-import findings into `projscan_doctor`'s issue list.
- **HTML report export** - standalone HTML health report.
- **Watch mode** - re-scan on file changes.

---

## Recently Shipped

### v0.12.x
- **Java** as a first-class language. `javaAdapter` via tree-sitter-java (~405 KB vendored wasm). Imports (typed / wildcard / static), public exports (class / interface / enum / record / annotation), CC, callSites, Maven + Gradle source-root detection.
- **Ruby** as a first-class language. `rubyAdapter` via tree-sitter-ruby (~2.0 MB vendored wasm). `require` / `require_relative` / `load` / `autoload` imports, top-level class / module / def exports, CC, callSites, gem / Rails / plain layout detection.
- **`callSites`** for Python and Go (parity with JS/TS) - "who calls `foo()`?" works on Python and Go repos now.
- **Workspace-aware `outdated`** - per-package `package.json` enumeration with `--package <name>` scoping.
- **Semantic-search discoverability hint** - first lexical search without `@xenova/transformers` installed prints a one-line tip; README gains an "Optional features" section.
- **Performance benchmark suite** (`npm run bench`) - measures cold/warm timing for analyze/doctor/hotspots/coupling/search across the projscan repo + a 500-file synthetic fixture. Reference numbers in README.
- **`docs/STABILITY.md`** - documents the stable surface (CLI flags, MCP tool names + input schemas, JSON output keys, exit codes) vs the unstable surface (internal modules, score magnitudes, console whitespace, cache layout).
- **`CONTRIBUTING.md`** "Areas wanting help" section with concrete on-ramps.
- **God-file refactor.** `src/cli/index.ts` (1,582 LOC) split into a 50-line dispatcher + 21 per-command files; `src/mcp/tools.ts` (925 LOC) split into a 58-line barrel + 16 per-tool files. Public CLI / MCP surface unchanged.
- **Removed: telemetry subsystem.** `projscan_telemetry`, `projscan telemetry`, `.projscanrc telemetry` block, `PROJSCAN_TELEMETRY` env, and `src/core/telemetry.ts` all gone. Local JSONL writer with no aggregation pipeline wasn't earning its keep. Future telemetry, if any, will be remote-sink-with-dashboard or not at all.
- MCP tool count: 17 → 16. Runtime deps: 9 → 11. Vendored wasm: ~850 KB → ~3.3 MB. 719 tests passing (+60 over 0.11).

### v0.11.x
- **Signal Quality.** AST cyclomatic complexity replaces LOC in the hotspot risk score (per-file McCabe via Babel walker for JS/TS, tree-sitter walker for Python + Go). New `projscan_coupling` MCP tool + CLI command surfaces fan-in / fan-out / instability and Tarjan-detected import cycles. `projscan_file` enriched with CC + fan-in/fan-out.
- **PR-aware structural diff.** New `projscan_pr_diff` returns the structural diff between two refs (exports + imports + callsites + ΔCC + Δfan-in). Stands up a temporary git worktree at the base ref. Heuristic export-rename detection (max of normalized Levenshtein and shared-affix; threshold 0.5) reclassifies +/- pairs as `~` renames.
- **Monorepo.** Detection for npm/yarn workspaces (`package.json#workspaces`), pnpm (`pnpm-workspace.yaml`), Lerna (`lerna.json#packages`), Nx (`workspaceLayout` + `project.json` scan + legacy `workspace.json#projects`). Turbo as marker (it doesn't declare workspaces). New `projscan_workspaces` tool. `--package <name>` scope on hotspots, coupling, analyze, doctor, structure, coverage, search, pr-diff. Cross-package graph edges flagged in coupling output.
- **Telemetry.** Opt-in privacy-preserving telemetry (off by default; `.projscanrc` + `PROJSCAN_TELEMETRY` env override + kill-switch). Records only tool name, duration, success, version, timestamp. Local JSONL sink. New `projscan_telemetry` MCP tool with `aggregate: true` arg returns per-tool histograms (count, p50/p95/p99, error rate). `projscan telemetry --aggregate` CLI mirror.
- **Go.** `goAdapter` mirrors the Python adapter pattern. Tree-sitter-go (~210 KB vendored wasm). Module-path resolution via `go.mod`. Capitalization-rule export visibility. Full pipeline parity with JS/TS and Python.
- **Cache v2 → v3** (CC persisted per file; v2 caches discarded on first 0.11 run). MCP tool count: 13 → 17. Runtime deps: 8 → 9. Vendored wasm: ~640 KB → ~850 KB.
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
