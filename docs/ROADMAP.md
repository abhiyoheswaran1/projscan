# ProjScan Roadmap

Planned features and improvements. Community suggestions welcome - open an issue or PR.

---

## Big bet: "Agent-First"

The tool is repositioning. The MCP server is the product; the CLI is a consumer of the same primitives.

## Path to v1.0 — five releases, one ship

v1.0 ships when (a) the [stability contract](STABILITY.md) has survived one full release cycle without a stable-surface break, (b) at least one external contributor has merged a non-trivial PR, and (c) we publicly commit to no stable-surface break without a major bump.

The five releases below stage that path. Each is additive against the stable surface; together they answer the four questions an agent has at every code-review or refactor moment: *what's wrong, is this PR safe, what should I change, and what breaks if I do?*

### v0.13.0 - "Agent Review + Stability Proof"

**Headline:** `projscan_review` so an agent gets a full PR risk picture in one tool call.

- **`projscan_review` MCP tool + `projscan review` CLI.** Composes `pr_diff` + per-changed-file risk + new cycles introduced + new high-CC functions + dep changes. One call returns the full review picture.
- **Per-function cyclomatic complexity.** `LanguageAdapter.parse()` returns `functions: [{name, line, cc}]`; persisted in the graph + cache (cache v3 → v4). Surfaced via new `projscan_file` field and "top-N risky functions" view in `projscan_hotspots`.
- **Cycle promotion to `projscan_doctor`.** `cycle-detected` issue type lifted from `projscan_coupling` so doctor callers don't miss circular imports.
- **Workspace-aware `dependencies` and `audit`.** Closes the 0.11 monorepo carry-over: `dependencies` (unused-dep) runs per-package; `audit` fans out per-workspace where the lockfile structure allows; root manifest catches files not claimed by any workspace.
- **Stable-surface CI guard.** `scripts/check-stability.mjs` diffs the live tool manifest + documented JSON keys + exit codes against a checked-in baseline; CI fails on regression. The baseline is bumped only on majors. This is what *proves* the contract held this cycle.
- **Reference-repo perf numbers.** Run `npm run bench` against TypeScript, a large Python repo (Django), and a large Go repo (kubernetes/client-go); publish cold/warm numbers in the README. Defends "scales" with real data.

### v0.14.0 - "Agent Fix Loop"

**Headline:** close the find→fix loop. Today projscan diagnoses; agents have to invent the fix.

- **`projscan_fix_suggest` MCP tool + `projscan fix-suggest` CLI.** Given an issue ID (or file + rule), return a structured action prompt: what's wrong, why it matters, where to change, and a one-paragraph instruction the agent can paste into its plan. Rule-driven (no LLM inside projscan); the agent is the LLM.
- **`projscan_explain_issue`.** Deep dive on a single issue: surrounding code excerpt, related issues, similar fixes already merged in this repo (via git log search), suggested test to pin the fix.
- **Actionable hints inline in `projscan_doctor`.** Each issue carries an optional `suggestedAction` field referencing the fix-suggest pipeline.
- **Cross-package import policy analyzer.** New analyzer warns when one workspace package deep-imports another's internals (anything outside the importee's published `main`/`exports`). Configurable via `.projscanrc` `monorepo.importPolicy`.

### v0.15.0 - "Reach"

**Headline:** blast-radius analysis. Before the agent edits `foo()`, what breaks?

- **`projscan_impact <symbol>`.** Transitive call-graph reachability: who calls foo, who calls those callers, etc. Returns ranked-by-distance file list with cycle-safe traversal.
- **Reverse impact (`projscan_impact <file>`).** Same idea at file granularity: every file transitively depending on this one. Pairs with `pr_diff`.
- **Per-function fan-in/fan-out.** Once per-function CC lands in 0.13, lift fan-in/fan-out to the same granularity using callSites.
- **Sub-file embeddings.** Chunk large files per-function for semantic search; embedding cache keyed by function-hash so edits don't re-embed the whole file.

### v0.16.0 - "Live"

**Headline:** keep the index fresh while the agent works.

- **Watch mode (`projscan watch`).** Re-scan on file changes; emits MCP notifications so an agent's view stays current across a long session.
- **Incremental graph rebuild.** Today every command rebuilds. Instead: only re-parse changed files; patch the graph in place. Foundational for watch mode.
- **HTML report export (`--format html`).** Standalone single-file HTML; useful for sharing a snapshot in a PR comment or CI artifact.
- **Long-session perf hardening.** Profile + fix any leaks/regressions surfaced by watch-mode dogfooding.

### v0.17.0 - "RC + Docs"

**Headline:** lock the surface, polish the docs, prove the contract.

- **1.0 documentation pass.** GUIDE rewrite around the agent journey (diagnose → review → fix → reach → live). Reference docs auto-generated from the tool manifest.
- **Deprecation cleanup.** Anything pre-1.0 that we want to leave behind, removed now (with a CHANGELOG entry); after this nothing further until 2.0.
- **Surface freeze.** Re-baseline `scripts/check-stability.mjs`; nothing in the stable surface may move until 2.0.
- **Final perf pass.** Refresh reference-repo benches; publish a "what to expect at scale" matrix.
- **External contributor gate work.** "Good first issue" pipeline filled and a documented `LanguageAdapter` walkthrough in CONTRIBUTING; if at least one non-trivial external PR has merged by the end of 0.17, we ship 1.0.

### v1.0.0 - "Stable"

**Headline:** the public commitment.

- **No code change vs 0.17.x.** 1.0 is a label release: bump version, drop "0.x" hedging from README, announce the semver commitment.
- **Public commitment.** README + STABILITY.md updated to declare: from this point, breaking the stable surface requires a 2.0 bump and one minor of deprecation warning.
- **Announcement post.** What projscan is, what it isn't, the agent journey, the language matrix, the perf numbers.

---

## Backlog (post-1.0)

Picked up if user demand surfaces.

- **Registry-aware upgrade preview** - `projscan upgrade <pkg>` optionally fetches `latest` from npm registry; Python equivalent reads pip/poetry metadata.
- **SAST-style security rules** - extend securityCheck with AST-based path-traversal, SQL-injection, XSS rules. Stays minimal; not competing with Snyk.
- **Plugin API** - third-party analyzers and reporters.
- **Multi-repo dashboard / SaaS** - upload baselines, team health trends, org-wide hotspots.
- **Additional languages** - Rust, C#, PHP, Kotlin via the same adapter pattern.

---

## Recently Shipped

### v0.14.x - "Agent Fix Loop"
- **`projscan_fix_suggest` MCP tool + `projscan fix-suggest` CLI** - rule-driven action prompts for open issues. Hand-tuned templates for ~12 common issue families plus a severity-anchored generic fallback. No LLM inside projscan; the agent is the LLM.
- **`projscan_explain_issue` MCP tool + `projscan explain-issue` CLI** - deep dive: code excerpt around the location, related issues touching the same file, similar past commits via `git log --grep=<rule>`, plus the structured FixSuggestion.
- **Inline `suggestedAction` on every doctor/analyze issue** - one-line hint pointing at `projscan fix-suggest <id>`. Console + markdown reporters render it inline.
- **Cross-package import policy analyzer.** New `crossPackageImportCheck` reads `.projscanrc` `monorepo.importPolicy: [{from, allow?, deny?}]` and flags each violation as a `cross-package-violation-N` issue. Off by default; allow-list semantics; glob support (`*`, `pkg/*`, `*/sub`).
- MCP tool count: 17 → 19. 780 tests passing (+21 over 0.13).

### v0.13.x - "Agent Review + Stability Proof"
- **`projscan_review` MCP tool + `projscan review` CLI** - one-call PR review composing structural diff + per-changed-file risk + new/expanded import cycles + risky function additions + dependency changes + a verdict (`ok`/`review`/`block`).
- **Per-function cyclomatic complexity** across all six adapters (JS/TS, Python, Go, Java, Ruby). Surfaced in `projscan_file` (new `functions` field, sorted by CC desc) and via a new `view: "functions"` mode on `projscan_hotspots`. Cache v3 → v4.
- **Cycle promotion to `projscan_doctor`.** `cycleCheck` analyzer lifts Tarjan-detected circular imports into the doctor issue list as `cycle-detected-N` issues, severity warning. Capped at 20 cycles to keep doctor output bounded.
- **Workspace-aware `dependencies` and `audit`.** Closes the 0.11 monorepo carry-over: `analyzeDependencies` walks every workspace manifest with a `byWorkspace` breakdown; `runAudit` gains a `packageFilter` that scopes findings to a single workspace's direct deps. CLI: `--package <name>` on both. MCP: `package` arg on both tools.
- **Stable-surface CI guard.** `scripts/check-stability.mjs` diffs live tool inventory + CLI commands + exit codes against `stability-baseline.json`. Additions pass; removals/renames fail. Wired into CI (`npm run check:stability`). The mechanism that *proves* the v1.0 stability contract held across a release cycle.
- **Reference-repo bench (`npm run bench:references`).** Shallow-clones microsoft/TypeScript, django/django, kubernetes/client-go into `.bench-cache/` and runs the standard suite. Reproducible perf numbers for the README's "scales to" claim.
- MCP tool count: 16 → 17. Cache: v3 → v4. 759 tests passing (+40 over 0.12).

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
