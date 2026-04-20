# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
