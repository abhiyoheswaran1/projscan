# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-04-20

### Theme — "Smart Search"

Ranked local search across content, symbols, and paths. No embeddings, no API calls, no 100MB model downloads — just a solid BM25 implementation that beats substring matching for most code-search queries.

**Why not embeddings in 0.7?** The only credible local-embeddings path in Node.js (`@xenova/transformers`) pulls a ~100MB ONNX model. For code search — where queries and identifiers share vocabulary (`auth`, `jwt`, `token`, `session`) — BM25 + symbol weighting captures most of the semantic value at 0% of the install-size cost. True semantic search is deferred; the door is explicitly left open as a future opt-in peer dep.

### Added

- **`src/core/searchIndex.ts`** — BM25-ranked inverted index over source files. Indexes content, exported symbol names, and path tokens separately, each with its own weight.
- **Query expansion** — camelCase / snake_case / digit splitting, light stemming (strip trailing `-s` / `-ing` / `-ed`), stopword + TS-keyword filtering. `userAuthToken` indexes as `user`, `auth`, `token`.
- **Symbol-match boost** — files that export a name matching the query rank higher than files that merely mention it. `authenticate` as a function name beats `authenticate` as a comment.
- **Upgraded `projscan_search` MCP tool** — scope `auto` (default, BM25-ranked content + excerpt) joins existing `symbols` / `files` / `content` scopes. Returns ranked matches with file + line + excerpt.
- **New CLI command `projscan search <query>`** — same ranked search from the terminal. Supports `--scope`, `--limit`, and all three output formats.
- **Public API:** `buildSearchIndex`, `search`, `tokenize`, `expandQuery`, `attachExcerpts`.

### Fixed

- **MCP budget sidecar corrupted array responses.** When a tool handler returned an array and the budget truncated it, the server spread the array into `{ ...value, _budget }` — producing `{ "0": …, "1": …, _budget }` garbage. Now wraps non-object values as `{ value, _budget }`.
- **Hotspot ↔ issue linking used fragile substring matching.** Issues about `src/ab.ts` could falsely attach to `src/a.ts`. Now prefers `issue.locations` when present and uses path-boundary guards for the legacy substring fallback.
- **Dead `src/utils/cache.ts` removed** — our own dead-code analyzer flagged it; deleting resolves the finding.

### Changed (dogfooding)

- Added **`.projscanrc.json`** to the repo — ignores the hardcoded-secret test fixture (`tests/analyzers/securityCheck.test.ts`) and disables the `large-utils-dir` rule that we intentionally trip. Demonstrates the config loader on real code.
- Added **`.prettierrc`** and **`.editorconfig`** to resolve the two lingering "missing config" warnings on projscan itself.
- Our own `projscan doctor` score goes from D/51 → A/100. The tool is now healthy by its own standards.

### Notes

- 249 tests passing (+14 new).
- Zero new runtime dependencies.
- All offline, no network.

## [0.6.0] - 2026-04-20

### Theme — "Agent-First"

**projscan is repositioning as an MCP-native code-intelligence tool.** The CLI still works identically; nothing breaks. But the product center of gravity moves to the MCP server, and everything below is in service of that: AI coding agents (Claude Code, Cursor, Windsurf, custom) are now first-class consumers, not an afterthought.

### Added

- **Real AST parsing** via [`@babel/parser`](https://babeljs.io/docs/babel-parser) — replaces regex in `src/core/fileInspector.ts`. Handles JS/TS/JSX/MJS/CTS with decorator, dynamic-import, top-level-await, and error-recovery support. `import type`, re-exports, and dynamic `import()` now captured correctly (regex was missing all three).
- **Code graph** (`src/core/codeGraph.ts`) — new core primitive. Files + exports + imports + call sites, bidirectional edges, built from real ASTs. Relative import resolution covers extension inference, barrel files (`foo/index.ts`), and `.js` specifiers that resolve to `.ts` under NodeNext.
- **Incremental index cache** (`src/core/indexCache.ts`) — mtime-keyed parse cache at `.projscan-cache/graph.json` (auto-gitignored). First run populates; subsequent runs re-parse only changed files. Agent queries against warm caches are millisecond-fast, not second-slow.
- **MCP context-token budgeter** (`src/mcp/tokenBudget.ts`) — every MCP tool call accepts an optional `max_tokens` argument. When set, projscan serializes the result and, if over budget, truncates the largest array field record-by-record until it fits. Ships a `_budget` sidecar on truncated responses so the agent knows it got a partial view.
- **New MCP tool `projscan_graph`** — query the code graph directly. Directions: `imports`, `exports`, `importers`, `symbol_defs`, `package_importers`. Agents can ask "who imports this file?" or "where is `runAudit` defined?" and get an answer in milliseconds without loading 11 other tools.
- **New MCP tool `projscan_search`** — fast structural search. Scopes: `symbols` (exports), `files` (path substring), `content` (source substring with line + excerpt). Replaces the temptation to shell out to `grep`.
- **Public API:** `parseSource`, `isParseable`, `buildCodeGraph`, `filesImportingFile`, `filesImportingPackage`, `filesDefiningSymbol`, `exportsOf`, `importsOf`, `importersOf`, `loadCachedGraph`, `saveCachedGraph`, `invalidateCache`, `applyBudget`, `estimateTokens`.

### Changed

- **`buildImportGraph` is now a compat shim** — backed by AST-based `buildCodeGraph` internally. Accuracy improves (no more regex false negatives), API is unchanged.
- **MCP tools now advertise `max_tokens`** — the new two explicitly, but the dispatcher applies the budget to every tool call whether the schema mentions it or not. Agents can set `max_tokens` on any existing tool (`projscan_hotspots`, `projscan_coverage`, etc.) and get right-sized output.
- **Two new runtime dependencies:** `@babel/parser` (~1.5MB) and `@babel/types`. Deliberate trade-off — regex hit an accuracy ceiling and every downstream analyzer was building on sand. "Real AST parsing" is a 0.6 headline; the zero-heavy-deps claim ends here.

### Fixed (from the AST migration)

- `import type { X }` now captured everywhere. Was silently dropped by the old regex, under-reporting imports in the graph.
- Dynamic `import('./lazy.js')` now captured.
- `export * as ns from './foo.js'` and other re-export shapes now captured.
- Unused-dependency and unused-exports analyzers are measurably more accurate as a side effect — no more flagging files that are reachable via type-only imports or dynamic loads.

### Notes

- **202 → 235 tests** (+33). Every new primitive has dedicated coverage.
- All offline. Cache file is the only disk artifact, lives at `.projscan-cache/`, is gitignored automatically.
- CLI output is unchanged. If you use projscan-the-CLI today, 0.6.0 is a no-op feature bump (with faster subsequent runs thanks to the cache).

## [0.5.0] - 2026-04-20

### Added — "Deeper Signal" theme

- **`projscan coverage`** — parses test coverage from `coverage/lcov.info`, `coverage/coverage-final.json`, or `coverage/coverage-summary.json`, joins it with the hotspot ranking, and surfaces the **scariest untested files**: high-risk × low-coverage. Works with Vitest, Jest, c8, Istanbul — any tool that emits one of the three standard formats.
- **Coverage-weighted hotspot risk** — `computeRiskScore` now takes an optional `coverage` input. Uncovered churning files bubble up the ranking; fully covered files see no change. New reason tags: `low coverage (X%)`, `moderate coverage (X%)`.
- **Dead-code analyzer** — new issue type `unused-exports-<file>`. Builds the full import graph across source, and flags non-barrel / non-test source files whose exports nothing imports. Respects `package.json#main`, `#exports`, `#bin`, `#types`. Handles ESM `import type`, dynamic `import()`, re-exports (`export { x } from ...`), and `.js` specifiers that resolve to `.ts` files under NodeNext.
- **Existing `projscan hotspots` now surfaces coverage** — when a coverage file exists, `hotspots` automatically reads it and includes per-file coverage in the output (no flag needed).
- **`FileHotspot.coverage`** — new optional field on hotspot entries.
- **New MCP tool:** `projscan_coverage`.
- **Public API:** `parseCoverage`, `coverageMap`, `joinCoverageWithHotspots`.
- **New types:** `CoverageSource`, `FileCoverage`, `CoverageReport`, `CoverageJoinedHotspot`, `CoverageJoinedReport`.

### Fixed

- **`extractImports` regex was missing type-only imports** — `import type { X } from './foo.js'` wasn't being captured, which silently under-counted imports in the graph. Now handles:
  - ESM `import type`
  - ESM re-exports (`export { x } from ...`, `export * as y from ...`)
  - Dynamic `import('...')`
  This makes the unused-dependency and unused-export analyzers more accurate.

### Notes

- All coverage parsing is offline and file-based. No runners invoked, no network.
- Coverage is additive — projects without a coverage file get the same hotspot output as before.
- Tests: 202 passing (+17 new).
- Zero new runtime dependencies. Still 4 packages in `dependencies`.

## [0.4.0] - 2026-04-20

### Added — "Dependency Health" theme

- **`projscan outdated`** — offline outdated check. Compares versions declared in `package.json` against the versions actually installed under `node_modules/` and classifies drift (patch / minor / major / same / unknown). No network calls.
- **`projscan audit`** — runs `npm audit --json` and normalizes the output into a projscan-shaped report: severity summary, per-package findings with title/URL/range/fix-available. SARIF output routes every finding into GitHub Code Scanning with `audit-<pkg>` rule IDs, anchored to `package.json`. Graceful messages for yarn/pnpm projects.
- **`projscan upgrade <pkg>`** — preview the impact of upgrading a package, fully offline. Reports semver drift, extracts the relevant section of the package's own `CHANGELOG.md` from `node_modules/<pkg>/`, highlights breaking-change markers (`BREAKING CHANGE`, `deprecated`, `removed support`, `no longer supported`), and lists every file in your source that imports the package.
- **Unused-dependency analyzer** — new issue type `unused-dependency-<name>`. Builds an import graph across all source files (ES imports + CommonJS requires), diffs against declared dependencies, and emits issues anchored to the exact line in `package.json`. Implicit-use allowlist covers typescript, eslint/prettier/vite plugins, types packages, and packages invoked via `package.json` scripts — with a `disableRules` escape hatch for the rest.
- **`package.json` locations on every dependency-related issue** — `dep-risk-*` and `unused-dependency-*` issues now carry `locations: [{ file: 'package.json', line }]`. SARIF upload to GitHub Code Scanning annotates the offending dependency line directly in PR review.
- **3 new MCP tools**: `projscan_outdated`, `projscan_audit`, `projscan_upgrade`.
- **Public API:** `buildImportGraph`, `toPackageName`, `isPackageUsed`, `filesImporting`, `detectOutdated`, `runAudit`, `auditFindingsToIssues`, `previewUpgrade`, `findDependencyLines`, `parseSemver`, `compareSemver`, `semverDrift`.
- **New types:** `SemverDrift`, `OutdatedPackage`, `OutdatedReport`, `AuditSeverity`, `AuditFinding`, `AuditReport`, `UpgradePreview`.

### Changed

- Issue engine now includes the unused-dependency analyzer alongside the six existing checks.
- `dep-risk-*` issues now carry `package.json` locations (line-level for package-specific risks, file-level for project-level risks like `excessive-dependencies`).

### Notes

- Everything in 0.4.0 is **offline-first** — no registry calls, no changelog fetching from GitHub. `projscan upgrade` reads the CHANGELOG that npm already placed in your `node_modules/<pkg>/`. Network-fetching upgrade preview is deferred to a later release.
- Zero new runtime dependencies. Still 4 packages in `dependencies`.
- Tests: 185 passing (+37 new).

## [0.3.1] - 2026-04-20

### Changed

- **Docs: thorough pass for 0.3.0 features.** `docs/GUIDE.md` rewritten to cover `hotspots`, `file`, `mcp`, SARIF output, `.projscanrc` config, and `--changed-only` PR-diff mode — plus a dedicated Configuration section, an updated Global Options table, an expanded CI/CD Integration section covering the first-party GitHub Action, and a refreshed Project Internals directory map. Fixed a stale note that claimed "no `.projscanrc` file needed."
- **README: quick-start examples surface `--changed-only` and `--format sarif`** so 0.3.0's CI-native story is visible above the fold.
- **CLI banner and help text refreshed:** `projscan help` now lists `hotspots`, `file`, `mcp`, `ci --changed-only`, and `ci --format sarif`; global-options table now documents `--config`, `--changed-only`, `--base-ref`, and `sarif` as a valid `--format`. "What's new" panel updated to 0.3.0's headline features.
- **CONTRIBUTING.md:** project structure tree fixed (`fixers/` → `fixes/`, added `core/` and `mcp/`, listed the new SARIF reporter, config loader, and changed-files helper).

### CI

- **Publish workflow hardened** — checks out the tagged ref (not HEAD of main), verifies `package.json` version matches the tag before publishing, adds `workflow_dispatch` so a failed publish can be retried without cutting a new release, and adds a concurrency guard against racing re-runs.
- **Node bumped to 22** across the publish workflow and the CI matrix (now 20 / 22 / 24). Node 20 is being deprecated on GitHub-hosted runners in June 2026. `engines` stays at `>=18` for install compatibility.

No runtime behavior changes. No API changes.

## [0.3.0] - 2026-04-20

### Added

- **SARIF output** (`--format sarif`) — emit SARIF 2.1.0 from `analyze`, `doctor`, and `ci`. Feeds directly into GitHub Code Scanning (and any other SARIF consumer), so projscan findings show up in the Security tab as annotated results with file/line locations.
- **`--changed-only` mode** — restrict `analyze`, `doctor`, and `ci` to issues in files changed vs a base ref. `--base-ref <ref>` overrides the default (auto-detects `origin/main` → `origin/master` → `main` → `master` → `HEAD~1`). Makes PR CI runs ~10× faster and only gates on issues the PR introduced.
- **`.projscanrc` config** — load project-wide defaults from `.projscanrc.json`, `.projscanrc`, or a `"projscan"` key in `package.json`. Supports:
  - `minScore` — default threshold for `ci`.
  - `baseRef` — default base ref for `--changed-only`.
  - `hotspots.limit`, `hotspots.since` — defaults for `hotspots`.
  - `ignore` — extra glob patterns layered onto the built-in ignore list.
  - `disableRules` — silence rules by id (supports `rule-id` or wildcard `prefix-*`).
  - `severityOverrides` — remap a rule's severity (`info` / `warning` / `error`).

  CLI flags always win over config; use `--config <path>` to load a specific file.
- **First-party GitHub Action** (`action.yml`) — composite action that installs projscan, runs `projscan ci --format sarif` (optionally `--changed-only`), writes a SARIF file, uploads to GitHub Code Scanning, and exposes `score` / `grade` outputs plus a Job Summary.
- **Issue locations** — `Issue` now carries optional `locations: IssueLocation[]` (file, line, column). Security checks populate real file/line locations (including line numbers for hardcoded secrets), and architecture checks anchor large-dir issues to their directory. Used by SARIF, `--changed-only`, and future file-centric outputs.
- Public API: `loadConfig`, `applyConfigToIssues`, `getChangedFiles`, `issuesToSarif`.
- New types: `IssueLocation`, `ProjscanConfig`, `LoadedConfig`.

### Changed

- `scanRepository(rootPath, { ignore })` now accepts optional ignore globs that layer onto the built-in list. The CLI passes `config.ignore` through automatically.
- `projscan ci` no longer hard-codes `--min-score 70`; missing flag falls back to `config.minScore`, then to 70.
- `ReportFormat` type now includes `'sarif'`.

## [0.2.0] - 2026-04-19

### Added

- **`projscan hotspots`** — ranks files by risk using `git log` churn × complexity (lines of code) × open issues × recency. Turns a flat health score into a prioritized "fix these first" list. Graceful fallback when the project is not a git repository.
- **`projscan file <path>`** — per-file drill-down combining the file's purpose, imports, exports, hotspot risk data, ownership, and the health issues that reference it. Natural follow-up to `projscan hotspots`.
- **`projscan mcp`** — runs projscan as an MCP (Model Context Protocol) server over stdio. Now exposes:
  - **Tools** (7): `projscan_analyze`, `projscan_doctor`, `projscan_hotspots`, `projscan_file`, `projscan_explain`, `projscan_structure`, `projscan_dependencies`.
  - **Prompts** (2): `prioritize_refactoring` (ranked plan grounded in live hotspots), `investigate_file` (senior-engineer brief for a specific file).
  - **Resources** (3): `projscan://health`, `projscan://hotspots`, `projscan://structure` — readable by agents on demand.
- **Ownership / bus-factor analysis** — hotspots now include `primaryAuthor`, `primaryAuthorShare`, `topAuthors`, and a `busFactorOne` flag (single-author + high churn ⇒ organizational risk). Bus-factor-1 files add a score penalty and a reason tag.
- **Hotspot trend tracking** — `.projscan-baseline.json` now snapshots top hotspots; `projscan diff` reports hotspots that *rose*, *fell*, *appeared*, or were *resolved* since the baseline (alongside existing issue deltas).
- Public API: `analyzeHotspots`, `computeRiskScore`, `inspectFile`, `createMcpServer`, `runMcpServer`, `getToolDefinitions`, `getPromptDefinitions`, `getResourceDefinitions`.
- New types: `FileHotspot`, `HotspotReport`, `AuthorShare`, `FileInspection`, `BaselineHotspot`, `HotspotDelta`, `HotspotDiffSummary`, `McpToolDefinition`, `McpPromptDefinition`, `McpResourceDefinition`.

### Changed

- `projscan diff --save-baseline` now captures a hotspot snapshot too, enabling trend analysis on subsequent diffs.
- Explain/file parsing logic (imports, exports, purpose inference) extracted into a shared `fileInspector` module used by both the CLI and MCP server — removes ~150 lines of duplication.

## [0.1.3] - 2026-03-11

### Added

- Health scoring system: every `projscan doctor` run now shows an A/B/C/D/F grade (0–100 score)
- `projscan badge` command: generates shields.io badge URL and markdown for READMEs
- Score integrated into all output formats (console, JSON, markdown)
- Automated npm publish workflow (GitHub Actions on Release)
- CONTRIBUTING.md, CHANGELOG.md, GitHub issue templates, CI workflow

## [0.1.0] - 2026-03-11

### Added

- `projscan analyze` — full project analysis (languages, frameworks, dependencies, issues)
- `projscan doctor` — project health check with actionable recommendations
- `projscan fix` — auto-fix for missing ESLint, Prettier, Vitest, and .editorconfig
- `projscan explain <file>` — file-level explanation (purpose, imports, exports)
- `projscan diagram` — ASCII architecture diagram
- `projscan structure` — directory tree visualization
- `projscan dependencies` — dependency audit and risk analysis
- Multiple output formats: console, JSON, markdown
- Detection for 30+ languages and 15+ frameworks
- Performance: 5k files in <1.5s, 20k files in <3s
