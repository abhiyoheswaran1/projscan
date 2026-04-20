# ProjScan — Full Guide

A deep dive into everything ProjScan can do. For a quick overview, see the [README](../README.md).

As of 0.6.0, **ProjScan is agent-first**: the MCP server is the primary interface, and the CLI is a consumer of the same primitives. This guide covers both, but if you're integrating with Claude Code / Cursor / Windsurf, start with [MCP Server for AI Agents](#mcp-server-for-ai-agents).

---

## Table of Contents

- [Installation](#installation)
- [Your First Scan](#your-first-scan)
- [Commands In Depth](#commands-in-depth)
  - [analyze](#analyze)
  - [doctor](#doctor)
  - [hotspots](#hotspots)
  - [file](#file)
  - [ci](#ci)
  - [diff](#diff)
  - [fix](#fix)
  - [explain](#explain)
  - [diagram](#diagram)
  - [structure](#structure)
  - [dependencies](#dependencies)
  - [outdated](#outdated)
  - [audit](#audit)
  - [upgrade](#upgrade)
  - [coverage](#coverage)
  - [badge](#badge)
  - [mcp](#mcp)
- [Health Score](#health-score)
- [Output Formats](#output-formats)
  - [Console](#console-default)
  - [JSON](#json)
  - [Markdown](#markdown)
  - [SARIF](#sarif)
- [Configuration (`.projscanrc`)](#configuration-projscanrc)
- [PR-Diff Mode (`--changed-only`)](#pr-diff-mode---changed-only)
- [Global Options](#global-options)
- [What ProjScan Detects](#what-projscan-detects)
  - [Languages](#languages)
  - [Frameworks and Libraries](#frameworks-and-libraries)
  - [Issues and Health Checks](#issues-and-health-checks)
- [Auto-Fix System](#auto-fix-system)
- [Architecture Diagrams](#architecture-diagrams)
- [File Explanation Engine](#file-explanation-engine)
- [Hotspots & Ownership](#hotspots--ownership)
- [MCP Server for AI Agents](#mcp-server-for-ai-agents)
- [Performance](#performance)
- [Common Workflows](#common-workflows)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)
- [Project Internals](#project-internals)

---

## Installation

### Global install (recommended)

```bash
npm install -g projscan
```

After installing, the `projscan` command is available everywhere.

### Run without installing

```bash
npx projscan
```

### Requirements

- Node.js >= 18
- npm, yarn, or pnpm
- Git (optional — unlocks `hotspots` and `--changed-only`)

---

## Your First Scan

Navigate into any repository and run:

```bash
cd your-project
projscan
```

This runs the default `analyze` command. Within a second or two you'll see a full report covering:

<img src="npx%20projscan.png" alt="npx projscan" width="700">

1. **Project overview** — name, total files, total directories, scan time
2. **Language breakdown** — primary language, percentages per language
3. **Frameworks detected** — with confidence levels and categories
4. **Dependency summary** — production vs. dev count, package manager, lock file status
5. **Issues found** — grouped by severity (error, warning, info)

---

## Commands In Depth

### analyze

```bash
projscan analyze
```

The flagship command. Runs every detection module and produces the full project report.

**What it does internally:**
1. Walks the file tree (respecting ignore patterns for `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.nuxt`, and any extra globs from your `.projscanrc`)
2. Builds a language breakdown by mapping file extensions to language names
3. Detects frameworks by inspecting `package.json` dependencies and config file presence
4. Analyzes dependencies from `package.json`
5. Runs all issue analyzers (ESLint, Prettier, tests, architecture, dependency risk, security)
6. Applies `.projscanrc` rules (disabled rules, severity overrides)
7. Renders the combined report

**Options:**

| Flag | Description |
|------|-------------|
| `--changed-only` | Only report issues on files changed vs base ref |
| `--base-ref <ref>` | Git base ref for `--changed-only` (default: origin/main) |

<img src="npx%20projscan.png" alt="npx projscan analyze" width="700">

### doctor

```bash
projscan doctor
```

A focused health check. Runs only the issue detection pipeline and presents results as a health report with a health score and letter grade.

Use this when you want a quick "is this project in good shape?" answer without the full language/framework breakdown.

**Options:**

| Flag | Description |
|------|-------------|
| `--changed-only` | Only report issues on files changed vs base ref |
| `--base-ref <ref>` | Git base ref for `--changed-only` (default: origin/main) |

<img src="npx%20projscan%20doctor.png" alt="npx projscan doctor" width="700">

**Severity levels:**
- **error** (✖) — Problems that should be addressed immediately
- **warning** (⚠) — Issues that affect code quality or maintainability
- **info** (ℹ) — Suggestions for best practices

### hotspots

```bash
projscan hotspots
```

Ranks files by **risk** — a combination of git churn, complexity (lines of code), open issues, recency, and ownership (bus-factor). Turns a flat health score into a prioritized "fix these first" list.

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--limit <n>` | Number of hotspots to show | 10 (or `hotspots.limit` from `.projscanrc`) |
| `--since <when>` | Git history window (e.g. `"6 months ago"`, `"2024-01-01"`) | `12 months ago` |

**What you get per file:**
- `riskScore` — combined score (0–100)
- `churn` — number of commits touching the file in the window
- `distinctAuthors` — how many people have touched it
- `primaryAuthor` / `primaryAuthorShare` — who owns most of the history
- `busFactorOne` — **true** if a single author dominates AND churn is high (organizational risk)
- `issueIds` — open issues that reference the file
- `reasons` — human-readable tags explaining the score

**Fallback:** If the project isn't a git repository, hotspots returns `available: false` with a friendly reason — it does not crash.

### file

```bash
projscan file src/cli/index.ts
```

Per-file drill-down. Combines everything ProjScan knows about a file into one view:

- **Purpose** — inferred from name and directory
- **Imports** / **exports** — from regex-based static analysis
- **Hotspot risk** — the file's entry from `hotspots` (churn, score, owner, bus factor)
- **Related issues** — every open issue whose `locations` reference the file
- **Inline smells** — large files, `console.log`, TODO/FIXME, `any` types

Natural follow-up to `projscan hotspots` — once hotspots tells you *which* file to look at, `file` tells you *what* to do about it.

### ci

```bash
projscan ci
```

A CI-pipeline-friendly health gate. Runs the full health check and exits with code 1 if the score falls below a threshold. No spinners or banners — clean output for CI logs.

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--min-score <n>` | Minimum passing score (0–100) | `minScore` from `.projscanrc`, else 70 |
| `--changed-only` | Gate only on issues in files changed vs base ref | off |
| `--base-ref <ref>` | Git base ref for `--changed-only` | auto (origin/main → origin/master → main → master → HEAD~1) |

**Example:**

```bash
$ projscan ci --min-score 80

projscan: B (82/100) — 0 errors, 2 warnings, 1 info — PASS (threshold: 80)
```

<img src="npx%20projscan%20ci%20--min-score%2070.png" alt="npx projscan ci" width="700">

**Exit codes:**
- `0` — Score meets or exceeds the threshold
- `1` — Score is below the threshold

**JSON output** (useful for scripts):

```bash
projscan ci --min-score 70 --format json
```

**SARIF output** (for GitHub Code Scanning or any SARIF consumer):

```bash
projscan ci --format sarif > projscan.sarif
```

**PR-diff mode** (only gate on issues in changed files):

```bash
projscan ci --changed-only
projscan ci --changed-only --base-ref origin/develop
```

See [PR-Diff Mode](#pr-diff-mode---changed-only) for details.

### diff

```bash
projscan diff
```

Compare your project's current health and hotspots against a saved baseline. Useful for tracking whether a codebase is improving or degrading over time.

**Options:**

| Flag | Description |
|------|-------------|
| `--save-baseline` | Save current health + top hotspots as the baseline |
| `--baseline <path>` | Path to baseline file (default: `.projscan-baseline.json`) |

**Workflow:**

```bash
# Step 1: Save current state as baseline
$ projscan diff --save-baseline

  Baseline saved to /path/to/project/.projscan-baseline.json
  Score: D (60/100)
  Issues: 2
  Hotspots snapshotted: 14

# Step 2: Make changes, then compare
$ projscan diff
```

The diff reports four hotspot movements: files that **rose**, **fell**, **appeared**, or were **resolved** since the baseline — alongside the usual new/resolved issue lists.

<img src="npx%20projscan%20diff%20--save-baseline.png" alt="npx projscan diff --save-baseline" width="700">

### fix

```bash
projscan fix
```

Detects fixable issues and offers to auto-remediate them. Shows you exactly what will change before applying anything.

**Non-interactive mode:**

```bash
projscan fix -y
```

**Available fixes:**

| Fix | What it creates | What it installs |
|-----|----------------|-----------------|
| ESLint | `eslint.config.js` (with TypeScript support if TS is detected) | `eslint`, `@eslint/js`, optionally `typescript-eslint` |
| Prettier | `.prettierrc` with sensible defaults | `prettier` |
| Test framework | `vitest.config.ts` + sample test file, adds `test` script to package.json | `vitest` |
| EditorConfig | `.editorconfig` (UTF-8, LF, 2-space indent, trim trailing whitespace) | Nothing |

### explain

```bash
projscan explain <file>
```

Analyzes a single file and explains what it does. Uses regex-based static analysis — no AI, no network calls.

**What it detects:**
- **Purpose** — Inferred from the file name and directory
- **Imports** — Both ES module `import` and CommonJS `require` statements
- **Exports** — Functions, classes, variables, types, interfaces, default exports
- **Potential issues** — Files over 500 lines, `console.log` statements, TODO/FIXME comments, usage of `any` type

<img src="npx%20projscan%20explain.png" alt="npx projscan explain" width="700">

### diagram

```bash
projscan diagram
```

Generates an ASCII architecture diagram. Scans your directory structure and framework detection results to identify architectural layers.

<img src="npx%20projscan%20diagram.png" alt="npx projscan diagram" width="700">

### structure

```bash
projscan structure
```

Renders a tree view of the project directory with file counts per directory.

<img src="npx%20projscan%20structure.png" alt="npx projscan structure" width="700">

### dependencies

```bash
projscan dependencies
```

Deep dive into your project's dependency graph — production/dev counts, package manager, lock file presence, and risk analysis (wildcard versions, `latest` tags, excessive counts).

<img src="npx%20projscan%20dependencies.png" alt="npx projscan dependencies" width="700">

### outdated

```bash
projscan outdated
```

Offline drift check — compares the version declared in `package.json` against the version installed under `node_modules/<pkg>/package.json`. Classifies each package as `patch`, `minor`, `major`, `same`, or `unknown` drift. Does **not** hit the npm registry.

**Output fields per package:**
- `declared` — the range in `package.json` (e.g., `^1.2.3`)
- `installed` — the concrete version in `node_modules`, or `null` if not installed
- `latest` — same as `installed` in offline mode (registry-aware preview is planned)
- `drift` — classification
- `scope` — `dependency` or `devDependency`

JSON / Markdown formats supported. No SARIF — this isn't a vulnerability signal.

### audit

```bash
projscan audit
```

Wraps `npm audit --json` and normalizes the output. Requires a `package-lock.json`. Graceful error for `yarn.lock` / `pnpm-lock.yaml` projects (suggests the right native command).

**Per-finding fields:** `name`, `severity` (`critical` / `high` / `moderate` / `low` / `info`), `title`, `url`, `cve`, `via`, `range`, `fixAvailable`.

**Summary:** counts per severity.

**SARIF output:**

```bash
projscan audit --format sarif > audit.sarif
```

Each finding becomes a SARIF result with `ruleId: audit-<pkg>`, severity mapped to `error` / `warning` / `note`, anchored to `package.json`. Pipe into `github/codeql-action/upload-sarif` or the first-party projscan Action and vulnerabilities show up in the Security → Code scanning tab.

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--timeout <ms>` | Override npm audit timeout | 60000 |

### upgrade

```bash
projscan upgrade <package>
```

Preview the impact of upgrading a package — fully offline.

**What you get:**
- Drift classification (`patch` / `minor` / `major`)
- Breaking-change markers found in the CHANGELOG: scans for `BREAKING CHANGE`, `deprecated`, `removed support`, `no longer supported`, and section headers containing "breaking"
- CHANGELOG excerpt sliced to the relevant version range (read from `node_modules/<pkg>/CHANGELOG.md`)
- Importer list — every file in your source tree that imports the package (direct or sub-path)

**Example:**

```bash
$ projscan upgrade react --format markdown

# Upgrade Preview — `react`
- Declared: `^18.2.0`
- Installed: `18.3.1`
- Drift: **minor**

## Importers (14)
- `src/App.tsx`
- `src/components/Button.tsx`
- ...
```

**Limitations:**
- Reads the CHANGELOG that npm already placed in `node_modules/`. If the package author doesn't ship one, you'll see "No local CHANGELOG found."
- Works with what's **installed**, not what's latest on the registry. Registry-aware preview is on the roadmap.

### coverage

```bash
projscan coverage
```

Joins test coverage with the hotspot ranking and produces a list sorted by "risk × uncovered fraction" — the files that most deserve tests.

**Supported formats** (auto-detected in this order):
- `coverage/lcov.info` — lcov format (Vitest, Jest, c8)
- `coverage/coverage-final.json` — Istanbul per-file detail
- `coverage/coverage-summary.json` — Istanbul summary

**Output fields per entry:**
- `relativePath` — file path
- `riskScore` — the file's hotspot risk
- `coverage` — line coverage %, or `null` if the file isn't in the coverage report
- `priority` — `riskScore × (0.3 + 0.7 × uncoveredFraction)`; files without coverage data treat `uncovered = 1`
- `reasons` — inherited from the hotspot entry, including any `low coverage (X%)` or `moderate coverage (X%)` tags

**Options:**

| Flag | Description | Default |
|------|-------------|---------|
| `--limit <n>` | Number of entries to return | 30 (max 200) |

**How it feeds into `hotspots`:** when any coverage file exists, `projscan hotspots` automatically passes it into the risk calculator. Uncovered churning files get a score bump and a `low coverage (X%)` reason tag. No coverage file? Hotspots behaves exactly as before.

### badge

```bash
projscan badge
```

Calculates the project health score and generates a [shields.io](https://shields.io) badge you can add to your README.

<img src="npx%20projscan%20badge.png" alt="npx projscan badge" width="700">

### mcp

```bash
projscan mcp
```

Runs ProjScan as an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server over stdio. AI coding agents (Claude Code, Cursor, Windsurf, any MCP client) can call ProjScan during a session to ground their suggestions in live project state.

See [MCP Server for AI Agents](#mcp-server-for-ai-agents).

---

## Health Score

Every `projscan doctor` and `projscan badge` run calculates a health score from 0 to 100 based on detected issues.

**Scoring:**

| Severity | Deduction per issue |
|----------|-------------------|
| Error | -20 points |
| Warning | -10 points |
| Info | -3 points |

**Grade thresholds:**

| Grade | Score Range | Meaning |
|-------|-------------|---------|
| A | 90–100 | Excellent — project follows best practices |
| B | 80–89 | Good — minor improvements possible |
| C | 70–79 | Fair — several issues to address |
| D | 60–69 | Poor — significant issues found |
| F | < 60 | Critical — major issues need attention |

The score appears in all output formats:
- **Console**: Shown at the top of the doctor report
- **JSON**: Included as `health.score` and `health.grade` fields
- **Markdown**: Shown as a heading with an auto-generated shields.io badge
- **SARIF**: Not surfaced directly — SARIF is per-issue, not per-project. The score still drives `ci`'s exit code.

---

## Output Formats

Every command supports the `--format` flag.

### Console (default)

Rich, colored terminal output with Unicode box-drawing characters and status icons. Best for interactive use.

### JSON

Machine-readable output. Useful for piping into other tools, storing results, or building dashboards.

```bash
projscan analyze --format json | jq '.issues[] | select(.severity == "error")'
projscan analyze --format json > analysis.json
```

### Markdown

Formatted Markdown suitable for saving as documentation or pasting into a PR description.

```bash
projscan doctor --format markdown > HEALTH.md
```

### SARIF

[SARIF 2.1.0](https://sarifweb.azurewebsites.net/) output — the industry standard for static analysis results. GitHub Code Scanning, Azure DevOps, GitLab, and many other systems consume SARIF natively.

```bash
projscan ci --format sarif > projscan.sarif
```

Supported on `analyze`, `doctor`, and `ci`. Each issue is emitted as a SARIF `result` with:
- `ruleId` — stable rule identifier (e.g., `hardcoded-secret`, `missing-prettier`)
- `level` — `error`, `warning`, or `note` (mapped from projscan severity)
- `message.text` — the issue description
- `locations` — real file + line/column when the analyzer can supply them (security findings include line numbers); project-level issues anchor to repo root
- `properties.category` — the analyzer category (`security`, `formatting`, `architecture`, …)
- `properties.fixAvailable` — whether `projscan fix` can remediate it

When uploaded to GitHub Code Scanning, findings appear in the **Security → Code scanning** tab and (for PRs) as inline annotations on changed lines.

---

## Configuration (`.projscanrc`)

ProjScan loads a project-wide config from one of:

1. A path passed via `--config <path>`
2. `.projscanrc.json` at the repository root
3. `.projscanrc` at the repository root (JSON format)
4. A `"projscan"` key in `package.json`

**CLI flags always win over config.** The config provides defaults; flags override on a per-run basis.

### Example `.projscanrc.json`

```json
{
  "minScore": 80,
  "baseRef": "origin/main",
  "ignore": ["**/fixtures/**", "**/generated/**"],
  "disableRules": ["missing-editorconfig", "large-*"],
  "severityOverrides": {
    "missing-prettier": "info"
  },
  "hotspots": {
    "limit": 20,
    "since": "6 months ago"
  }
}
```

### Fields

| Field | Type | Effect |
|-------|------|--------|
| `minScore` | number (0–100) | Default threshold for `projscan ci`. Clamped to 0–100. |
| `baseRef` | string | Default base ref for `--changed-only`. |
| `ignore` | string[] | Extra glob patterns added to the built-in ignore list (`node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.nuxt`, `.cache`, `.turbo`, `.output`). |
| `disableRules` | string[] | Silence rules by id. Exact match (`missing-prettier`) or wildcard prefix (`large-*`). |
| `severityOverrides` | `Record<string, 'info' \| 'warning' \| 'error'>` | Remap a rule's severity. Useful for downgrading project-specific false positives without disabling them. |
| `hotspots.limit` | number (1–100) | Default limit for `projscan hotspots`. |
| `hotspots.since` | string | Default git history window for `projscan hotspots`. |

Invalid JSON in a discovered config file is a hard error — projscan exits rather than silently ignoring it.

### Embedded config in `package.json`

If you prefer to keep everything in `package.json`:

```json
{
  "name": "my-app",
  "projscan": {
    "minScore": 80,
    "disableRules": ["missing-editorconfig"]
  }
}
```

---

## PR-Diff Mode (`--changed-only`)

For CI on pull requests, you usually only care about issues that **this PR introduced** — not the long tail of legacy warnings elsewhere in the repo. `--changed-only` scopes the report to files changed vs a base ref.

**How it decides what's "changed":**

1. If `--base-ref <ref>` is passed explicitly, use that.
2. Otherwise, try in order: `origin/main`, `origin/master`, `main`, `master`, `HEAD~1`.
3. If none of those refs exist, fall back to uncommitted working-tree changes (`git status --porcelain`).
4. If the project isn't a git repository, skip the filter and report everything, with a warning on stderr.

**How it filters:**

Issues that carry a `location` (file path) are kept only if that file appears in the changed set. **Project-level issues without a location are dropped** in `--changed-only` mode — that's intentional: "No ESLint config" is a real issue, but it shouldn't block every PR that doesn't touch ESLint.

**When to use it:**

- `projscan ci --changed-only` on every PR
- Skip it on pushes to `main` (you want to see all project-level issues there)
- Combine with a looser `--min-score` on PRs and a stricter one on `main`

Example GitHub Actions snippet:

```yaml
- uses: abhiyoheswaran1/projscan@v0.3.0
  with:
    min-score: ${{ github.event_name == 'pull_request' && '60' || '70' }}
    changed-only: ${{ github.event_name == 'pull_request' }}
```

---

## Global Options

| Option | Description |
|--------|-------------|
| `--format <type>` | Output format: `console` (default), `json`, `markdown`, `sarif` |
| `--config <path>` | Path to a `.projscanrc` config file |
| `--changed-only` | Scope to files changed vs base ref (applies to `analyze`, `doctor`, `ci`) |
| `--base-ref <ref>` | Git base ref for `--changed-only` (default: origin/main) |
| `--verbose` | Show debug-level logging — useful for diagnosing scan issues |
| `--quiet` | Suppress all non-essential output (spinners, status messages) |
| `-V, --version` | Print the version number |
| `-h, --help` | Print help for any command |

**Per-command help:**

```bash
projscan fix --help
projscan ci --help
```

---

## What ProjScan Detects

### Languages

ProjScan maps file extensions to language names. Supported languages include TypeScript, JavaScript, Python, Go, Rust, Java, C#, C++, C, Ruby, PHP, Swift, Kotlin, Dart, Lua, Scala, R, Shell, CSS, SCSS/Sass, HTML, JSON, YAML, Markdown, SQL, and more.

The **primary language** is the one with the most files.

### Frameworks and Libraries

Detection uses two strategies:

**1. Dependency scanning** — checks `package.json` for known framework packages:

React, Next.js, Vue.js, Nuxt.js, Svelte, SvelteKit, Angular, Solid.js, Express, Fastify, NestJS, Hono, Koa, Apollo Server, tRPC, Prisma, Drizzle ORM, Mongoose, TypeORM, Sequelize, Tailwind CSS, Vite, Webpack, Rollup, esbuild, Vitest, Jest, Mocha, Cypress, Playwright, Storybook, and more.

**2. Config file presence** — checks for known configuration files:

`next.config.js`, `nuxt.config.ts`, `svelte.config.js`, `angular.json`, `vite.config.ts`, `webpack.config.js`, `tailwind.config.js`, `prisma/schema.prisma`, `docker-compose.yml`, `Dockerfile`, and more.

Each detection has a **confidence level** (high, medium, low) and a **category** (frontend, backend, testing, bundler, css, other).

### Issues and Health Checks

ProjScan ships with six analyzer modules:

#### 1. ESLint Check
- Looks for `.eslintrc.*`, `eslint.config.*`, or `eslintConfig` in package.json
- If missing: warning with auto-fix available

#### 2. Prettier Check
- Looks for `.prettierrc`, `.prettierrc.*`, `prettier.config.*`, or `prettier` in package.json
- If missing: warning with auto-fix available

#### 3. Test Check
- Looks for test frameworks in devDependencies (vitest, jest, mocha, etc.)
- Looks for test files (`*.test.*`, `*.spec.*`, `__tests__/`)
- If no framework: warning with auto-fix available
- If framework exists but zero test files: separate warning

#### 4. Architecture Check
- **Large utility directories**: warns if `utils/`, `helpers/`, or `lib/` contains 10+ files (issue anchored to the directory path)
- **Missing .editorconfig**: info with auto-fix available
- **Missing/empty README**: warning / info

#### 5. Dependency Risk Check
- Warns if production dependencies exceed 50
- Errors if total dependencies exceed 100
- Flags `*` or `latest` version ranges
- Warns if no lock file is present

#### 6. Security Check
- **Committed `.env` files**: Flags `.env`, `.env.local`, `.env.production`, etc. (but not `.env.example`, `.env.sample`, `.env.template`) — location anchored to the file
- **Private key files**: Detects `.pem`, `.key`, `id_rsa`, `id_ed25519`, `.p12`, `.pfx` files
- **Hardcoded secrets**: Scans file contents (files under 512KB) for:
  - AWS Access Keys (`AKIA...`)
  - GitHub tokens (`ghp_...`, `ghs_...`)
  - Slack tokens (`xoxb-...`, `xoxp-...`)
  - Generic patterns (`password=`, `secret=`, `api_key=` with quoted values)
  - PEM private key headers
  Each finding carries the exact **line number** of the match, which SARIF and GitHub Code Scanning use for inline PR annotations.
- **Missing `.gitignore` entries**: Warns if `.env` is not in `.gitignore`

Every issue carries an optional `locations: IssueLocation[]` field. Analyzers populate it when the finding is tied to a specific file (and sometimes a specific line). This field powers SARIF output and `--changed-only` filtering.

---

## Auto-Fix System

The fix system is intentionally conservative. It only creates configuration files and installs well-known packages. It never modifies your source code.

### How fixes work

1. `projscan fix` runs the issue detection pipeline
2. Filters to issues where `fixAvailable: true`
3. Shows you exactly what each fix will do
4. Prompts for confirmation (unless `-y` is passed)
5. Applies fixes sequentially, showing progress
6. Reports success/failure for each fix

### Fix details

**ESLint fix:**
- Creates `eslint.config.js` using the flat config format (ESLint v9+)
- If TypeScript files are detected, includes `typescript-eslint` plugin
- Installs `eslint` and `@eslint/js` via the detected package manager

**Prettier fix:**
- Creates `.prettierrc` with these defaults:
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 100,
    "tabWidth": 2
  }
  ```
- Installs `prettier`

**Test framework fix:**
- Creates `vitest.config.ts`
- Creates a sample test file at `tests/example.test.ts`
- Adds `"test": "vitest run"` to package.json scripts (if not already present)
- Installs `vitest`

**EditorConfig fix:**
- Creates `.editorconfig`
- Installs nothing — EditorConfig is handled by editor plugins

---

## Architecture Diagrams

The `diagram` command builds a layered view of your application. It works by:

1. Scanning the top-level directory names in your project
2. Matching them against known patterns (e.g., `components/` -> Frontend, `routes/` -> API)
3. Cross-referencing with detected frameworks
4. Rendering only the layers that are present

This is heuristic-based and works best with conventional project structures. Projects with unconventional layouts will get a generic "Application" layer.

---

## File Explanation Engine

The `explain` command performs regex-based static analysis. It does not execute your code or make network calls.

**Import detection** handles:
- ES modules: `import { foo } from 'bar'`
- Default imports: `import foo from 'bar'`
- Namespace imports: `import * as foo from 'bar'`
- Side-effect imports: `import 'bar'`
- CommonJS: `const foo = require('bar')`

**Export detection** handles:
- Named exports: `export function`, `export class`, `export const`
- Type exports: `export interface`, `export type`
- Default exports: `export default`

**Purpose inference** is based on file name and directory conventions. For example:
- Files named `*.test.*` or `*.spec.*` → "Test file"
- Files in `routes/` → "Route definitions"
- Files named `index.ts` → "Module entry point"
- Files in `components/` → "UI component"

---

## Hotspots & Ownership

The `hotspots` command reads `git log` to build a per-file risk picture. The risk score combines five signals:

| Signal | Weight | Intuition |
|--------|--------|-----------|
| Churn | 0.40 | Files that change often are more likely to harbor bugs |
| Complexity (LOC) | 0.30 | Bigger files = more surface area |
| Issue density | 0.20 | Files that already have open issues need help |
| Recency | 0.10 | Recently touched hot files deserve attention first |
| Bus factor | penalty tag | Single-author + high churn = organizational risk |

**Ownership signals:**
- `primaryAuthor` — the top committer by share
- `primaryAuthorShare` — fraction of commits (0–1)
- `topAuthors` — ranked list
- `busFactorOne` — `true` if the primary author owns > 80% of commits **and** churn is above the median

**Bus-factor-one files get a score penalty and a `bus-factor-one` reason tag** — they show up higher in the ranking because if that one author leaves, the knowledge is gone.

**What "hotspots" can't do:**
- It's a heuristic, not a proof. Low-risk files may still have bugs.
- It weights LOC as a proxy for complexity; a clean 1,000-line file may rank higher than it deserves.
- It has no visibility into logical coupling — two small files that change together still look independent.

`projscan diff` snapshots the top 20 hotspots and tracks which ones **rose** / **fell** / **appeared** / **resolved** over time.

---

## MCP Server for AI Agents

`projscan mcp` runs ProjScan as an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server over stdio. AI coding agents can query ProjScan during a session to ground their suggestions in live project state.

**Tools (13):**
- `projscan_graph` — **structural query over the AST code graph.** Directions: `imports`, `exports`, `importers`, `symbol_defs`, `package_importers`. Agent-native; milliseconds on a warm cache.
- `projscan_search` — **fast symbol/file/content search.** Scopes: `symbols` (exported names), `files` (path substring), `content` (source substring with line + excerpt).
- `projscan_analyze` — full project snapshot
- `projscan_doctor` — health score + issue list
- `projscan_hotspots` — ranked file risk (`limit`, `since` args)
- `projscan_file` — per-file inspection (purpose, risk, ownership, related issues)
- `projscan_explain` — purpose, imports, exports, smells
- `projscan_structure` — directory tree
- `projscan_dependencies` — package audit
- `projscan_outdated` — declared-vs-installed drift (offline)
- `projscan_audit` — npm audit, normalized (severity summary + findings)
- `projscan_upgrade` — upgrade preview: drift + local CHANGELOG + importers (`package` arg required)
- `projscan_coverage` — coverage × hotspots, ranked by "risk × uncovered fraction" (`limit` arg)

**Every tool accepts `max_tokens` (optional).** projscan estimates serialized output and truncates the largest array field until it fits. Over-budget responses include a `_budget: { truncated: true, estimatedTokens, maxTokens }` field.

**Incremental cache:** projscan caches parsed ASTs at `.projscan-cache/graph.json`. First run populates, subsequent runs re-parse only files whose `mtime` changed. Auto-gitignored. Delete the directory to force a rebuild.

**Prompts (2, parameterized with live project data):**
- `prioritize_refactoring` — ranked plan grounded in current hotspots
- `investigate_file` — senior-engineer brief for a specific file

**Resources (3, readable on demand):**
- `projscan://health`
- `projscan://hotspots`
- `projscan://structure`

### Setup: Claude Code

```bash
claude mcp add projscan -- npx projscan mcp
```

### Setup: Cursor / Windsurf / any MCP client

```json
{
  "mcpServers": {
    "projscan": {
      "command": "npx",
      "args": ["projscan", "mcp"]
    }
  }
}
```

Once connected, your agent can ask *"what are the riskiest files in this repo?"* or *"run projscan_doctor before proposing an edit"* and get grounded answers.

---

## Performance

ProjScan is designed to be fast enough to run on every save or as a pre-commit hook.

| Metric | Target |
|--------|--------|
| 5,000 files | < 1.5 seconds |
| 20,000 files | < 3 seconds |
| Network requests | Zero |
| Runtime dependencies | 4 packages |

**How it stays fast:**
- Uses `fast-glob` for file walking
- Language detection is a pure function — no I/O, just extension mapping
- Framework detection reads at most one file (`package.json`) plus checks file names already in memory
- Hotspots is the only command that shells out to `git`; that's ~1s on a 5k-commit repo
- `--changed-only` mode scopes reporting (not scanning), so scan time is unchanged — but CI jobs with heavy parsing can pair it with a smaller file set if you want faster runs

---

## Common Workflows

### Onboarding to a new codebase

```bash
cd new-project
projscan                      # Full overview
projscan structure            # Understand the layout
projscan diagram              # See the architecture
projscan hotspots             # Which files are risky?
projscan file <path>          # Drill into a hotspot
```

### Pre-commit health check

```bash
projscan doctor
```

### Setting up a new project

```bash
mkdir my-project && cd my-project
npm init -y
projscan fix -y   # Set up ESLint, Prettier, Vitest, EditorConfig
```

### Generating a project report for a PR

```bash
projscan analyze --format markdown > ANALYSIS.md
```

### Tech-debt prioritization

```bash
projscan hotspots --format markdown > HOTSPOTS.md
# Paste into a tech-debt ticket
```

### Extracting data for a dashboard

```bash
projscan analyze --format json > /tmp/projscan-report.json
```

---

## CI/CD Integration

ProjScan has three first-class CI integration paths:

### 1. First-party GitHub Action (recommended)

The easiest path — installs projscan, runs the health gate, uploads SARIF to GitHub Code Scanning.

```yaml
name: ProjScan
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

permissions:
  contents: read
  security-events: write   # required for SARIF upload

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }   # needed for --changed-only
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - uses: abhiyoheswaran1/projscan@v0.3.0
        with:
          min-score: '70'
          changed-only: 'true'
```

**Inputs:** `min-score`, `changed-only`, `base-ref`, `config`, `sarif-file`, `upload-sarif`, `working-directory`, `version`.

**Outputs:** `score`, `grade`.

Findings show up in **Security → Code scanning**; PR annotations are automatic.

### 2. Plain workflow (no SARIF upload)

If you'd rather skip Code Scanning, the repo ships `.github/projscan-ci.yml` — a drop-in workflow that runs `projscan ci` and posts a markdown health report as a PR comment.

### 3. Any CI — raw `projscan ci`

The `ci` command is purpose-built for pipelines:

```bash
projscan ci                                 # Fail if score < 70 (default)
projscan ci --min-score 80                  # Custom threshold
projscan ci --changed-only                  # Gate only on PR diff
projscan ci --format json                   # JSON output for scripts
projscan ci --format sarif > projscan.sarif # SARIF for any consumer
```

**JSON output in a script:**

```bash
result=$(projscan ci --min-score 0 --format json)
pass=$(echo "$result" | jq '.ci.pass')
score=$(echo "$result" | jq '.ci.score')
echo "Score: $score, Pass: $pass"
```

### Tracking health over time in CI

Combine `ci` with `diff` to track regressions:

```bash
projscan diff --save-baseline        # Run once to create baseline
# Commit .projscan-baseline.json to your repo

# In CI, compare against baseline:
projscan diff --format json          # Shows new/resolved issues + hotspot movements
```

---

## Troubleshooting

### "No package.json found"

The `dependencies` and `fix` commands require a `package.json` in the current directory. Other commands (`analyze`, `structure`, `diagram`, `explain`) work without one.

### Scan is slow

If scanning takes more than a few seconds, check whether you have large unignored directories. ProjScan ignores `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.nuxt`, `.cache`, `.turbo`, and `.output` by default. Add your own patterns via `.projscanrc` → `ignore`.

### Hotspots shows "not a git repository"

`hotspots` needs git history to compute churn and ownership. Either run it inside a git repo, or skip the command.

### `--changed-only` reports everything

Check stderr for a warning. Most common causes:
- Running outside a git repository
- The base ref doesn't exist (e.g., `origin/main` isn't fetched in a shallow CI clone — set `fetch-depth: 0` in checkout)
- Fresh commit with no parent (no `HEAD~1`)

### SARIF upload fails with "permission denied"

The workflow needs `permissions: security-events: write`. The first-party Action sets this implicitly; plain workflows need to add it explicitly.

### Fix command fails to install packages

The fix system uses `npm install` by default. If you use yarn or pnpm, the install step may behave differently. Check your package manager's output for errors.

---

## Project Internals

For contributors and the curious — here's how ProjScan is structured:

```
src/
├── cli/
│   └── index.ts                 # CLI entry point; all commands defined here
├── core/
│   ├── repositoryScanner.ts     # File tree walking, directory tree building
│   ├── languageDetector.ts      # Extension -> language mapping
│   ├── frameworkDetector.ts     # Framework detection from deps + config files
│   ├── dependencyAnalyzer.ts    # package.json parsing, risk detection
│   ├── issueEngine.ts           # Runs all analyzers, aggregates issues
│   ├── hotspotAnalyzer.ts       # git churn × complexity × issues × ownership
│   ├── fileInspector.ts         # Per-file inspection (purpose, imports, exports, risk)
│   ├── importGraph.ts           # Source-wide import graph for unused-dep / dead-code
│   ├── outdatedDetector.ts      # Declared-vs-installed drift check (offline)
│   ├── auditRunner.ts           # npm audit wrapper + SARIF normalization
│   ├── upgradePreview.ts        # Offline upgrade preview (CHANGELOG + importers)
│   ├── coverageParser.ts        # lcov / coverage-final / coverage-summary parser
│   ├── coverageJoin.ts          # Join hotspots × coverage — "scariest untested files"
│   ├── ast.ts                   # @babel/parser wrapper → imports + exports + call sites
│   ├── codeGraph.ts             # Bidirectional file×symbol graph built from AST
│   └── indexCache.ts            # mtime-keyed .projscan-cache/graph.json
├── analyzers/
│   ├── eslintCheck.ts
│   ├── prettierCheck.ts
│   ├── testCheck.ts
│   ├── architectureCheck.ts
│   ├── dependencyRiskCheck.ts
│   ├── securityCheck.ts
│   ├── unusedDependencyCheck.ts
│   └── deadCodeCheck.ts
├── fixes/
│   ├── eslintFix.ts
│   ├── prettierFix.ts
│   ├── testFix.ts
│   ├── editorconfigFix.ts
│   └── fixRegistry.ts
├── reporters/
│   ├── consoleReporter.ts       # Rich terminal output with chalk
│   ├── jsonReporter.ts          # JSON output
│   ├── markdownReporter.ts      # Markdown output
│   └── sarifReporter.ts         # SARIF 2.1.0 output
├── mcp/
│   ├── server.ts                # JSON-RPC 2.0 dispatcher, stdio transport, max_tokens budgeting
│   ├── tools.ts                 # 13 MCP tools
│   ├── tokenBudget.ts           # Record-aware response truncator
│   ├── prompts.ts               # 2 parameterized prompts
│   └── resources.ts             # 3 on-demand resources
├── utils/
│   ├── fileWalker.ts            # fast-glob wrapper with ignore patterns
│   ├── logger.ts                # Structured logger with levels
│   ├── scoreCalculator.ts       # Health score + shields.io badge
│   ├── baseline.ts              # Baseline save/load/diff (issues + hotspots)
│   ├── config.ts                # .projscanrc loader + rule application
│   ├── changedFiles.ts          # git-based changed-files detector
│   ├── packageJsonLocator.ts    # Line-number lookup for package.json deps
│   ├── semver.ts                # Tiny semver parser/compare/drift
│   ├── banner.ts                # CLI banner + help rendering
│   └── cache.ts                 # Small LRU for hot paths
└── types.ts                     # All shared TypeScript interfaces
```

**Key design decisions:**
- **Single `types.ts`** — avoids circular dependencies between modules
- **ESM-only** — required by chalk v5 and ora v8; all imports use `.js` extensions
- **Pure functions where possible** — `detectLanguages` is pure (no I/O), trivially testable
- **No class hierarchies** — analyzers, fixes, reporters, and MCP tools are plain functions with consistent signatures
- **Opt-in config** — `.projscanrc` is never required, but when present it tunes defaults without needing to change CI scripts
