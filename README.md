<div align="center">

# projscan

[![npm version](https://img.shields.io/npm/v/projscan.svg)](https://www.npmjs.com/package/projscan)
[![license](https://img.shields.io/npm/l/projscan.svg)](https://github.com/abhiyoheswaran1/projscan/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/projscan.svg)](https://nodejs.org)

**Instant codebase insights — doctor, x-ray, and architecture map for any repository.**

[Install](#install) · [Quick Start](#quick-start) · [Commands](#commands) · [Full Guide](docs/GUIDE.md) · [Roadmap](docs/ROADMAP.md)

<img src="docs/hero.png" alt="projscan banner" width="600">

</div>

---

## Why?

Every time you clone a new repo, join a new team, or revisit an old project, you face the same questions:

- What language and framework is this?
- Is there linting? Testing? Formatting?
- What's the project structure?
- Are the dependencies healthy?

Answering these manually takes 10-30 minutes of poking through config files and directories.

**projscan answers all of this in one command, in under 2 seconds.**

```bash
npx projscan
```

<img src="docs/npx%20projscan.png" alt="npx projscan" width="700">

Run `projscan doctor` for a focused health check:

```bash
npx projscan doctor
```

<img src="docs/npx%20projscan%20doctor.png" alt="npx projscan doctor" width="700">

## Install

```bash
npm install -g projscan
```

Or run directly without installing:

```bash
npx projscan
```

## Quick Start

Run inside any repository:

```bash
projscan                            # Full project analysis
projscan doctor                     # Health check
projscan hotspots                   # Rank files by risk (churn × complexity × issues × ownership)
projscan file <path>                # Drill into a file — purpose, risk, ownership, issues
projscan fix                        # Auto-fix detected issues
projscan ci                         # CI health gate (exits 1 on low score)
projscan ci --changed-only          # Gate only on this PR's diff
projscan ci --format sarif          # SARIF 2.1.0 for GitHub Code Scanning
projscan outdated                   # Declared-vs-installed drift (offline)
projscan audit                      # npm audit, normalized + SARIF-ready
projscan upgrade <pkg>              # Preview upgrade impact (local CHANGELOG + importers)
projscan diff                       # Compare health + hotspot trends against a baseline
projscan diagram                    # Architecture visualization
projscan structure                  # Directory tree
projscan mcp                        # Run as an MCP server for AI coding agents
```

<img src="docs/npx%20projscan%20--help.png" alt="npx projscan --help" width="700">

For a comprehensive walkthrough, see the **[Full Guide](docs/GUIDE.md)**.

## Commands

| Command | Description |
|---------|-------------|
| `projscan analyze` | Full analysis — languages, frameworks, dependencies, issues |
| `projscan doctor` | Health check — missing tooling, architecture smells, security risks |
| `projscan hotspots` | Rank files by risk — churn × complexity × issues × ownership |
| `projscan file <path>` | Drill into a file — purpose, risk, ownership, related issues |
| `projscan fix` | Auto-fix issues (ESLint, Prettier, Vitest, .editorconfig) |
| `projscan ci` | CI health gate — SARIF output, `--changed-only` PR-diff mode, exits 1 if score below threshold |
| `projscan diff` | Compare current health **and hotspot trends** against a baseline |
| `projscan explain <file>` | Explain a file's purpose, imports, exports, and issues |
| `projscan diagram` | ASCII architecture diagram of your project |
| `projscan structure` | Directory tree with file counts |
| `projscan dependencies` | Dependency analysis — counts, risks, recommendations |
| `projscan outdated` | **Declared-vs-installed drift check** (offline) |
| `projscan audit` | **`npm audit`-powered vulnerability report** — SARIF-ready for Code Scanning |
| `projscan upgrade <pkg>` | **Preview upgrade impact** — local CHANGELOG + importer list, offline |
| `projscan badge` | Generate a health score badge for your README |
| `projscan mcp` | Run as an MCP server for AI coding agents (Claude Code, Cursor, …) |

To see all commands and options, run:

```bash
projscan --help
```

### Command Screenshots

<details>
<summary><strong>projscan structure</strong> — Directory tree with file counts</summary>

<img src="docs/npx%20projscan%20structure.png" alt="npx projscan structure" width="700">
</details>

<details>
<summary><strong>projscan diagram</strong> — Architecture visualization</summary>

<img src="docs/npx%20projscan%20diagram.png" alt="npx projscan diagram" width="700">
</details>

<details>
<summary><strong>projscan dependencies</strong> — Dependency analysis</summary>

<img src="docs/npx%20projscan%20dependencies.png" alt="npx projscan dependencies" width="700">
</details>

<details>
<summary><strong>projscan explain</strong> — File explanation</summary>

<img src="docs/npx%20projscan%20explain.png" alt="npx projscan explain" width="700">
</details>

<details>
<summary><strong>projscan badge</strong> — Health badge generation</summary>

<img src="docs/npx%20projscan%20badge.png" alt="npx projscan badge" width="700">
</details>

### Output Formats

All commands support `--format` for different output targets:

```bash
projscan analyze --format json       # Machine-readable JSON
projscan doctor --format markdown    # Markdown for docs/PRs
projscan ci --format sarif           # SARIF 2.1.0 for GitHub Code Scanning
```

Formats: `console` (default), `json`, `markdown`, `sarif`

### Options

| Flag | Description |
|------|-------------|
| `--format <type>` | Output format: console, json, markdown, sarif |
| `--config <path>` | Path to a `.projscanrc` config file |
| `--changed-only` | Scope to files changed vs base ref (ci/analyze/doctor) |
| `--base-ref <ref>` | Git base ref for `--changed-only` (default: origin/main) |
| `--verbose` | Enable debug output |
| `--quiet` | Suppress non-essential output |
| `-V, --version` | Show version |
| `-h, --help` | Show help |

## Health Score

Every `projscan doctor` run calculates a health score (0–100) and letter grade:

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90–100 | Excellent — project follows best practices |
| B | 80–89 | Good — minor improvements possible |
| C | 70–79 | Fair — several issues to address |
| D | 60–69 | Poor — significant issues found |
| F | < 60 | Critical — major issues need attention |

Generate a badge for your README:

```bash
projscan badge
```

This outputs a [shields.io](https://shields.io) badge URL and markdown snippet you can paste into your README.

**Sample badge:** [![projscan health](https://img.shields.io/badge/projscan-D-orange)](https://github.com/abhiyoheswaran1/projscan)

## What It Detects

**Languages**: TypeScript, JavaScript, Python, Go, Rust, Java, Ruby, C/C++, PHP, Swift, Kotlin, and 20+ more

**Frameworks**: React, Next.js, Vue, Nuxt, Svelte, Angular, Express, Fastify, NestJS, Vite, Tailwind CSS, Prisma, and more

**Issues**:
- Missing linting (ESLint) and formatting (Prettier) configuration
- Missing test framework
- Missing `.editorconfig`
- Large utility directories (architecture smell)
- Excessive, deprecated, or wildcard-versioned dependencies
- Missing lockfile
- Committed `.env` files and private keys (security)
- Hardcoded secrets — AWS keys, GitHub tokens, Slack tokens, generic passwords (security)
- Missing `.env` in `.gitignore` (security)

## Performance

- **5,000 files** analyzed in under 1.5 seconds
- **20,000 files** analyzed in under 3 seconds
- **Zero network requests** — everything runs locally
- **4 runtime dependencies** — minimal footprint

## CI/CD Integration

Use `projscan ci` to gate your pipelines:

```bash
projscan ci --min-score 70                     # Exits 1 if score < 70
projscan ci --min-score 80 --format json       # JSON output for parsing
projscan ci --changed-only                     # Gate only on this PR's diff
projscan ci --format sarif > projscan.sarif    # SARIF for Code Scanning
```

<img src="docs/npx%20projscan%20ci%20--min-score%2070.png" alt="npx projscan ci --min-score 70" width="700">

### GitHub Action (recommended)

projscan ships a first-party GitHub Action that installs, runs, and uploads SARIF to **GitHub Code Scanning** in one step:

```yaml
# .github/workflows/projscan.yml
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
        with: { fetch-depth: 0 }  # needed for --changed-only
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: abhiyoheswaran1/projscan@v0.3.0
        with:
          min-score: '70'
          changed-only: 'true'
```

Inputs: `min-score`, `changed-only`, `base-ref`, `config`, `sarif-file`, `upload-sarif`, `working-directory`, `version`. Outputs: `score`, `grade`.

Findings appear in the **Security → Code scanning** tab, annotated on files and lines. PRs get inline annotations on changed lines.

### Plain workflow (no SARIF upload)

If you'd rather not upload SARIF, [`.github/projscan-ci.yml`](.github/projscan-ci.yml) is a drop-in workflow that runs projscan and posts a markdown health report as a PR comment.

## Configuration (`.projscanrc`)

Drop a `.projscanrc.json` at your repo root to set defaults — CLI flags always win over config. A `"projscan"` key in `package.json` and plain `.projscanrc` are also supported.

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

Fields:

- `minScore` — default `ci` threshold (0–100)
- `baseRef` — default base ref for `--changed-only`
- `ignore` — extra glob patterns added to the built-in ignore list
- `disableRules` — silence rules by id; supports wildcard `prefix-*`
- `severityOverrides` — remap a rule's severity (`info` / `warning` / `error`)
- `hotspots.limit` / `hotspots.since` — defaults for the `hotspots` command

## Tracking Health Over Time

Save a baseline and compare later:

```bash
projscan diff --save-baseline       # Save current score
# ... make changes ...
projscan diff                       # Compare against baseline
projscan diff --format markdown     # Markdown diff for PRs
```

<img src="docs/npx%20projscan%20diff%20--save-baseline.png" alt="npx projscan diff --save-baseline" width="700">

## Hotspots — Where to Fix First

A flat health score doesn't tell you what to do. **`projscan hotspots`** combines `git log` churn, file complexity, open issues, recency, and **ownership** into a single risk score per file — so you know where refactoring or review will actually pay off.

```bash
projscan hotspots                       # Top 10 hotspots
projscan hotspots --limit 20
projscan hotspots --since "6 months ago"
projscan hotspots --format json         # Machine-readable for dashboards
projscan hotspots --format markdown     # Drop into a PR or tech-debt ticket
```

Hotspot ranking follows the classic Feathers "churn × complexity" heuristic with boosts for files that fail `projscan doctor`, changed recently, or show **bus factor 1** (single-author + high churn). Falls back gracefully outside a git repo.

### Drill Into a Hotspot

```bash
projscan file src/cli/index.ts
```

Combines the file's purpose, imports, exports, hotspot risk, ownership, and every open issue that references it — the natural follow-up to `projscan hotspots`.

### Track Trends Over Time

```bash
projscan diff --save-baseline           # Snapshots health + hotspots
# ...time passes, commits happen...
projscan diff                           # Shows which hotspots rose / fell
```

The baseline file now captures top hotspots too, so `diff` surfaces files that are **getting worse** (not just new issues).

## Dependency Health

projscan ships three focused commands for keeping your dependency graph healthy — all **offline** by default, no registry calls.

```bash
projscan outdated                       # Which declared deps drift from what's installed?
projscan outdated --format json         # Machine-readable drift report
projscan audit                          # Wrap npm audit; normalized, SARIF-ready
projscan audit --format sarif > a.sarif # Upload to GitHub Code Scanning
projscan upgrade chalk                  # What breaks if I bump chalk? Who imports it?
projscan upgrade chalk --format markdown # Paste-ready review comment
```

### What each one tells you

- **`outdated`** — reads `package.json` and `node_modules/<pkg>/package.json` to classify drift (`major` / `minor` / `patch` / `same` / `unknown`). No network.
- **`audit`** — wraps `npm audit --json`, normalizes the output, and emits SARIF with per-finding rules anchored to `package.json`. Graceful fallback message for yarn/pnpm projects.
- **`upgrade <pkg>`** — reads `node_modules/<pkg>/CHANGELOG.md`, slices the section between your installed version and the previous one, flags `BREAKING CHANGE` / `deprecated` / `removed support` markers, and lists every file in your repo that imports the package. All offline.

### Unused dependencies (automatic in `doctor`)

`projscan doctor` now flags declared dependencies that are never imported from source. Each finding is anchored to the **exact line in `package.json`** so GitHub Code Scanning PR annotations land in the right place.

Implicit-use packages (typescript, eslint/prettier plugins, `@types/*`, and anything invoked from a `package.json` script) are allowlisted. Override via `.projscanrc` → `disableRules` if projscan flags something that is used but not imported.

## AI Agent Integration (MCP)

**`projscan mcp`** starts an [MCP](https://modelcontextprotocol.io) server over stdio so AI coding agents can query projscan during a session.

**Tools** (10):
- `projscan_analyze` — full project report
- `projscan_doctor` — health score + issues
- `projscan_hotspots` — risk-ranked files (with `limit`, `since` args)
- `projscan_file` — per-file risk + ownership + related issues
- `projscan_explain` — per-file purpose, imports, exports, smells
- `projscan_structure` — directory tree
- `projscan_dependencies` — package audit
- `projscan_outdated` — declared-vs-installed drift
- `projscan_audit` — npm audit, normalized
- `projscan_upgrade` — offline upgrade preview with CHANGELOG + importers

**Prompts** (2, parameterized with live project data):
- `prioritize_refactoring` — ranked plan grounded in current hotspots
- `investigate_file` — senior-engineer brief for a specific file

**Resources** (3, readable on demand):
- `projscan://health` · `projscan://hotspots` · `projscan://structure`

### Claude Code

```bash
claude mcp add projscan -- npx projscan mcp
```

### Cursor / Windsurf / any MCP client

Add to your MCP config:

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

Now your agent can ask *"what are the riskiest files in this repo?"* and get a grounded answer, or run `projscan_doctor` before proposing an edit.

## Use Cases

- **Onboarding**: Understand any codebase in seconds, not hours
- **Code reviews**: Run `projscan doctor --format markdown` and paste into PRs
- **Tech-debt prioritization**: Use `projscan hotspots` to decide what deserves refactoring time
- **AI-assisted development**: Mount `projscan mcp` in your agent of choice for grounded edits
- **CI/CD**: Use `projscan ci` to enforce health standards in your pipeline
- **Security**: Catch committed secrets and `.env` files before they reach production
- **Consulting**: Quickly assess client projects before diving in
- **Maintenance**: Track health trends with `projscan diff` across releases

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
