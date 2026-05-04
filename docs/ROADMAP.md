# ProjScan Roadmap

Planned features and improvements. Community suggestions welcome - open an issue or PR.

---

## Big bet: "Agent-First"

projscan is built for AI coding agents first; the CLI is a consumer of the same primitives.

## Stable since 1.0

**v1.0.0 shipped 2026-05-04. The stability contract is in force.** The MCP tool inventory, CLI command names + documented flags, exit codes, JSON output keys, and the `dist/tool-manifest.json` schema are now under semver protection — see [`docs/STABILITY.md`](STABILITY.md). Breaking any of it requires a 2.0 bump preceded by a deprecation cycle (one minor release with a stderr warning, then removal in the next major). The CI guard (`scripts/check-stability.mjs`) enforces this on every PR.

The 1.0 surface was earned across five additive minor releases (0.13 → 0.17), each scoped around one of the four questions an agent has at every code-change moment: *what's wrong, is this PR safe, what should I change, and what breaks if I do?* The five themes were "Agent Review", "Agent Fix Loop", "Reach", "Live", and "RC + Docs"; full per-release notes live in [Recently Shipped](#recently-shipped) below.

## Planned (1.x.y — additive only)

These are candidates for future minor releases. They're additive against the stable surface; they will not break the 1.0 contract.

- **Additional language adapters.** Rust, PHP, C# via the same `LanguageAdapter` pattern. Pre-drafted issue stubs under `.github/seed-issues/` are the on-ramp.
- **More fix-suggest templates.** The rule registry covers ~12 issue families today; expanding to ESLint rules, Python type-error patterns, and Go vet output is mostly mechanical.
- **HTML reporter coverage.** Five commands have HTML output; extending to `pr-diff` and `coverage` is in `.github/seed-issues/`.
- **Registry-aware upgrade preview.** `projscan upgrade <pkg>` optionally fetches `latest` from npm registry; Python equivalent reads pip/poetry metadata. Behind a network-required flag.
- **MCP-side watch notifications.** 0.16's `projscan watch` is CLI-only. A future minor could emit `notifications/file_changed` over MCP so long-running agent sessions get a push instead of polling.
- **Per-function fan-out.** 0.15 added per-function fan-in. Fan-out requires per-function `callSites` tracking — bigger lift across all six adapters.

## Under consideration (2.0 — breaking)

These are candidates for the next major version. They are NOT planned for any 1.x release because they would break the stability contract.

- **Removing the deprecated regex extractors** (`extractImports` / `extractExports` in `src/core/fileInspector.ts`, marked `@deprecated` in 0.17). The graph-based path is strictly better; once all `projscan_explain` callers take a graph, the regex helpers can go.
- **JSON output schema refactors.** Some response shapes accumulated optional fields across 0.6 → 1.0 that would be cleaner as discriminated unions. Worth doing only if there's a real consumer pain point.
- **SAST-style security rules.** Extending `securityCheck` with AST-based path-traversal, SQL-injection, XSS rules. Stays minimal; not competing with Snyk. Not a 2.0 requirement, but if added it changes the issue-id namespace.
- **Plugin API.** Third-party analyzers and reporters. Would land as part of a 2.0 if it requires interface changes; otherwise additive.
- **Multi-repo dashboard / SaaS.** Upload baselines, team health trends, org-wide hotspots. Out of scope for projscan-the-tool; a separate product surface if it ever happens.

---

## Recently Shipped

### v1.0.0 - "Stable" (2026-05-04)
- **Public no-break commitment.** STABILITY.md and README updated to declarative present-tense: the stable surface is under semver protection, deprecation cycle in effect, breaking changes require 2.0.
- **No code changes vs 0.17.0.** The 1.0 git tree is identical to v0.17.0 except for `package.json#version`, this CHANGELOG entry, and the README/STABILITY language touch-ups.
- **CI publish workflow** made tolerant of pre-published versions — the false-red ❌ on releases that were published locally before the GitHub Release event triggered CI is gone.
- 820 tests passing, unchanged. 20 MCP tools, 22 CLI commands, 6 languages, 11 runtime deps, ~5.8 MB total install. The reference numbers in [Performance](../README.md#performance) are the 1.0 reference.

### v0.17.x - "RC + Docs"
- **GUIDE rewrite around the agent journey** — new top-of-doc section organizing the product around diagnose → review → fix → reach → live. Existing per-command reference preserved.
- **README "Security & trust" section** — direct, structural answer to supply-chain scanner alerts. Five subsections covering what projscan does and doesn't do.
- **Surface freeze** — `stability-baseline.json` re-baselined. The 0.17 surface is what 1.0 will commit to.
- **Performance baseline refresh** — fresh `npm run bench` numbers in README.
- **Contributor on-ramp** — `.github/ISSUE_TEMPLATE/good_first_issue.md`, eight seed-issue drafts under `.github/seed-issues/`, "First-time contributor walkthrough" in `CONTRIBUTING.md`.
- **Deprecation tagging** — `extractImports` / `extractExports` regex helpers marked `@deprecated`; scheduled for removal post-1.0.
- 820 tests passing (no new code paths). MCP tools, CLI commands, runtime deps unchanged.

### v0.16.x - "Live"
- **`projscan watch` CLI** — long-running watcher (`node:fs.watch`, no new dep). 200ms debounce; re-runs doctor on each batch; one-line status output.
- **`incrementallyUpdateGraph` public API** — targeted re-parse + in-place index rebuild. Used by `watch`; exported for callers maintaining their own state.
- **HTML report export (`--format html`)** — standalone single-file HTML with inline CSS, dark-mode aware. Renderers for doctor / hotspots / coupling / review / impact. Suitable for PR comments and CI artifacts.
- 820 tests passing (+18 over 0.15). MCP tool count unchanged; CLI gains `watch`.

### v0.15.x - "Reach"
- **`projscan_impact` MCP tool + `projscan impact` CLI** - transitive blast-radius for files and symbols. File mode = BFS over reverse imports. Symbol mode = direct callers (from callSites) + transitive importers. Cycle-safe; depth-bounded.
- **Per-function fan-in** computed in `buildCodeGraph` from cross-file callSites. Surfaced in `projscan_file`'s functions list. Approximate (name-based) and documented as such.
- **Sub-file embeddings** - opt-in `sub_file: true` on `projscan_search` chunks files at function boundaries. Cache key per chunk = `<file>#<fn-name>` so editing one function doesn't re-embed siblings. Semantic cache version v1 → v2.
- MCP tool count: 19 → 20. 802 tests passing (+22 over 0.14).

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
