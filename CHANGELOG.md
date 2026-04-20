# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
