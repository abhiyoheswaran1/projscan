# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `projscan hotspots` — ranks files by risk using `git log` churn × complexity (lines of code) × open issues × recency. Turns a flat health score into a prioritized "fix these files first" list. Graceful fallback when the project is not a git repository.
- `projscan mcp` — runs projscan as an MCP (Model Context Protocol) server over stdio, exposing `projscan_analyze`, `projscan_doctor`, `projscan_hotspots`, `projscan_explain`, `projscan_structure`, and `projscan_dependencies` as tools that AI coding agents (Claude Code, Cursor, etc.) can call to ground their work in project health.
- Public API: `analyzeHotspots`, `computeRiskScore`, `createMcpServer`, `runMcpServer`, `getToolDefinitions`.
- New types: `FileHotspot`, `HotspotReport`, `McpToolDefinition`.

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
