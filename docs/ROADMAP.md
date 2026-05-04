# ProjScan Roadmap

Last reviewed 2026-05-04 (post-1.0).

---

## Vision

**The shared code-intelligence substrate that AI coding agents stand on.**

Every agent (Claude Code, Cursor, Codex, Continue, custom orchestrations) needs the same things from the codebase it's editing: structural awareness, change-impact analysis, health signals, fix guidance. None of them want to build that themselves. projscan is the open, offline, agent-native MCP server that gives every agent the same accurate view — so they can spend their context and inference budget on the actual reasoning, not on greping the repo.

## Stable since 1.0

**v1.0.0 shipped 2026-05-04. The stability contract is in force.** The MCP tool inventory, CLI command names + documented flags, exit codes, JSON output keys, and the `dist/tool-manifest.json` schema are now under semver protection — see [`STABILITY.md`](STABILITY.md). Breaking any of it requires a 2.0 bump preceded by a deprecation cycle. The CI guard (`scripts/check-stability.mjs`) enforces this on every PR.

The 1.0 surface was earned across five additive minor releases (0.13 → 0.17), each scoped around one of the four questions an agent has at every code-change moment: *what's wrong, is this PR safe, what should I change, and what breaks if I do?* Per-release notes live in [Recently Shipped](#recently-shipped) below.

## Strategic context (May 2026)

Three forces define the next 12 months for projscan:

1. **MCP is the de-facto standard.** The ecosystem has 10,000+ public servers; Claude Code, Cursor, Continue, Windsurf, Codex all consume MCP. The protocol war is over; the value migrates to the *quality* of individual servers. Code-intelligence is one of the highest-value categories.
2. **Multi-agent orchestration is the 2026 dominant pattern.** Claude Agent Teams, swarms, sub-agents. The new pain point is *coordination*: agents have separate context windows and need a shared source-of-truth about the codebase. projscan's graph + cache + budget-aware tools are uniquely positioned to BE that shared substrate.
3. **Context-window cost compounds.** Token spend per turn is no longer the bottleneck — it's the *accumulated* cost of carrying tool results, AST excerpts, and prior turns through every inference call. Agents that retrieve narrowly and budget aggressively win. projscan's `max_tokens`-aware response shaping, cursor pagination, and per-function chunking are exactly the primitives this trend rewards.

## The competitive picture

| Tool | Position | What they do well | What we beat them on |
|---|---|---|---|
| **Code Pathfinder** | Direct competitor (MCP code-intel) | Deep static analysis: AST + CFG + DFG, dataflow tracking, security focus. On Anthropic's official MCP registry. | Language coverage (6 vs 1: Python). Composed agent tools (review / fix-suggest / impact / watch). Health signals (churn × CC, hotspots). Monorepo workspace awareness. |
| **Sourcegraph Cody / Amp** | Enterprise paid tier (Free killed July 2025) | Cross-repo indexing at org scale. Polished editor integrations. | Fully offline. Open source. No SaaS dependency. Free for everyone. |
| **Continue.dev** | Configurable RAG + MCP client | Highly extensible context providers. Local-first. | We're a *server*, not a client; we feed Continue (and every other MCP client). Different category. |
| **Aider** | Terminal-native pair programmer | Tight Git integration, conversational refactor flow. | Different category — we're not a coding agent; we're what coding agents stand on. |
| **GitHub MCP server** | Adjacent (repo metadata, not code intel) | Issues / PRs / Actions surface. | We do code structure; they do collaboration metadata. Complementary, not competing. |

**Where we're vulnerable:** Code Pathfinder has deeper analysis (CFG, DFG) and security-finding focus. They're on the official MCP registry; we're not.

**Where we lead:** breadth (6 languages), agent-native composition (one-call review, fix-suggest, impact), monorepo support, and the 1.0 stability contract. We also have the cleaner agent-journey product story (diagnose → review → fix → reach → live).

## Strategy

Three plays, in order:

1. **Defend the lead** — close the obvious gaps (Anthropic MCP registry listing, more languages, more fix-suggest templates) so users picking an MCP server for code intel have one less reason to go elsewhere.
2. **Lean into multi-agent** — make projscan the *shared substrate* for agent swarms. This is where the market is moving and where our context-budget design pays off.
3. **Expand the moat** — depth where it matters (CFG / dataflow on hot paths, sub-file embeddings, cross-repo views). Not everywhere; we're not trying to be Cody.

We are *not* trying to be:
- A coding agent (we're what agents call into).
- A SaaS / dashboard product (out of scope; would dilute the open-source positioning).
- A general-purpose static analyzer competing with SonarQube / Semgrep / Snyk.
- A linting / formatting tool (we *invoke* eslint / prettier / pytest / ruff, we don't replace them).

## Now / Next / Later

### Now — 1.1 → 1.3 (Q3 2026)

**Theme: "Defend & Discover"** — close the discoverability + parity gaps so projscan is the obvious pick for an agent picking a code-intel MCP server.

| Release | Theme | Headlines |
|---|---|---|
| **1.1.0 "On the Map"** | Discoverability + first-language expansion | Submit to Anthropic's MCP registry. Rust adapter (closes the most-asked language gap). Two new fix-suggest templates (eslint-* and python-type-error-*). Pre-drafted issue stubs under `.github/seed-issues/` are the contributor on-ramp. |
| **1.2.0 "Reporter Parity"** | Polish the surface | HTML reporters for `pr-diff` and `coverage` (closes the 0.16 gap). PHP and C# language adapters. Per-function fan-out (per-function `callSites` tracking added across all six adapters). |
| **1.3.0 "Push, Don't Poll"** | Long-session UX | MCP-side `notifications/file_changed` from `projscan watch` so agents in long sessions get a push, not a poll. Registry-aware upgrade preview behind a network-required flag (default off). Stretch: persistent process mode for `projscan mcp` so multiple agents share one warm graph. |

### Next — 1.4 → 1.6 (Q4 2026)

**Theme: "Agent Substrate"** — make projscan the shared source-of-truth for multi-agent setups. This is the strategic bet.

| Release | Theme | Bet |
|---|---|---|
| **1.4.0 "Session"** | Shared state across agents | New `projscan_session` MCP tool: a durable, cache-backed session that multiple agent invocations can attach to. Agents share a hot graph + a list of "what's been touched this session" without any one of them owning state. Pairs with multi-agent orchestrators (Claude Agent Teams, swarms). |
| **1.5.0 "Budgeted by default"** | Cost-aware tool composition | Every tool reports a token-cost estimate alongside its result. New `max_cost_tokens` arg auto-degrades response depth. `projscan_review` becomes adaptive: full review on a budget, summarized review at half, verdict-only at quarter. |
| **1.6.0 "Specialist prompts"** | Agent recipes, not tool docs | Ship a `prompts/` directory of MCP-protocol prompts that agents can invoke directly: `refactor-hotspot`, `triage-doctor-issues`, `review-this-pr`, `safely-rename-symbol`. Each is a tested composition of projscan tools with the right argument shape. Lowers integration friction from "which tools do I call in what order" to "ask the prompt by name". |

### Later — 1.7 → 1.9 and 2.0 (2027)

**Theme: "Depth and breadth"** — once we're the obvious pick for breadth + agent-native composition, sharpen the depth.

- **Sub-file embedding refinements.** Better recall, faster rebuild, smarter chunking for very long functions.
- **Read-only cross-repo view.** Useful for monorepo-of-monorepos and for agents that work across multiple repos (e.g. updating an SDK and its consumer apps in tandem).
- **Kotlin, Swift, C++ adapters.** In that order. Demand-driven; if Rust + PHP + C# don't move the needle, we don't add more.
- **Lightweight CFG/DFG hooks.** Not a full Pathfinder-style dataflow engine — just enough to answer "is this value tainted?" / "is this var used after assignment?" on hot paths inside `projscan_review`.
- **HTML report theming.** White-label the HTML output with a project name + logo.

**2.0 candidates** (breaking; do not promise dates):
- Remove deprecated `extractImports` / `extractExports` regex helpers (marked `@deprecated` in 0.17).
- Refactor JSON output schemas where optional-field accumulation became cluttered.
- Plugin API (third-party analyzers + reporters), if it requires interface changes that break the 1.0 contract.

## Non-goals

- **Coding agent.** We don't write code; we tell agents what's there.
- **SaaS / dashboard.** projscan is a local tool; cloud features (uploads, baselines, telemetry) are explicitly off the table for the 1.x line.
- **Snyk / SonarQube competition.** SAST stays minimal; if we add CFG/DFG it's narrowly targeted at agent use cases (taint tracking inside a review), not general security scanning.
- **IDE-specific extensions.** projscan is an MCP server. The CLI is for humans. No VS Code extension, no JetBrains plugin — those are someone else's product.
- **LLM-inside-projscan.** `projscan_fix_suggest` is rule-driven by design. The driving agent is the LLM; we feed it structured prompts. We will not embed an inference call.

## Risks

- **Anthropic MCP registry approval.** 1.1's "On the Map" hinges on getting projscan onto the official registry. Process is opaque. Mitigation: submit early, in parallel with the 1.1 work; if rejected, lean harder on README + GitHub topics + MCP-server-listing sites.
- **Code Pathfinder catches up on languages.** They're 1-language today (Python) but the AST + CFG infrastructure is solid. If they ship a JS/TS adapter, our breadth lead narrows. Mitigation: keep adding languages on the cadence (one per minor for the next three).
- **Multi-agent orchestration matures faster than we can ship Session.** If Claude Agent Teams becomes the default and ships its own shared-state primitive, our 1.4 bet weakens. Mitigation: design Session as a *complement* to Agent Teams rather than a replacement; expose it as MCP resources so it composes with whatever orchestrator a user has.
- **Single-maintainer velocity.** This roadmap assumes ~1 minor every 3-4 weeks. Sustainable if the seed-issues + good-first-issue pipeline brings in external PRs. If it doesn't, the 1.4 → 1.6 timeline slips.
- **Context-cost trend reverses.** If models get cheaper / context windows get cheaper / smarter, our budget-aware design becomes table stakes rather than a differentiator. Mitigation: that's a good problem to have; the underlying primitives still work.

## How to influence this roadmap

If you've adopted projscan and want something specific:
- **Open a GitHub issue** describing the use case. The "what an agent of mine couldn't answer" framing helps prioritize over generic feature requests.
- **Pick up a seed issue** at [`.github/seed-issues/`](.github/seed-issues/) — eight pre-drafted starter tasks, three of which are language adapters that would directly accelerate the 1.1 / 1.2 work.
- **For larger work** (a new MCP tool category, a refactor, a 2.0 candidate), open a discussion first so we can align on the shape before you spend a weekend on it.

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
