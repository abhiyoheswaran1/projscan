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
projscan            # Full project analysis
projscan doctor     # Health check
projscan hotspots   # Rank files by risk (git churn × complexity × issues)
projscan fix        # Auto-fix detected issues
projscan ci         # CI health gate (exits 1 on low score)
projscan diff       # Compare health against a baseline
projscan diagram    # Architecture visualization
projscan structure  # Directory tree
projscan mcp        # Run as an MCP server for AI coding agents
```

<img src="docs/npx%20projscan%20--help.png" alt="npx projscan --help" width="700">

For a comprehensive walkthrough, see the **[Full Guide](docs/GUIDE.md)**.

## Commands

| Command | Description |
|---------|-------------|
| `projscan analyze` | Full analysis — languages, frameworks, dependencies, issues |
| `projscan doctor` | Health check — missing tooling, architecture smells, security risks |
| `projscan hotspots` | Rank files by risk — git churn × complexity × open issues |
| `projscan fix` | Auto-fix issues (ESLint, Prettier, Vitest, .editorconfig) |
| `projscan ci` | CI pipeline health gate — exits 1 if score below threshold |
| `projscan diff` | Compare current health against a saved baseline |
| `projscan explain <file>` | Explain a file's purpose, imports, exports, and issues |
| `projscan diagram` | ASCII architecture diagram of your project |
| `projscan structure` | Directory tree with file counts |
| `projscan dependencies` | Dependency analysis — counts, risks, recommendations |
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
```

Formats: `console` (default), `json`, `markdown`

### Options

| Flag | Description |
|------|-------------|
| `--format <type>` | Output format: console, json, markdown |
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
projscan ci --min-score 70          # Exits 1 if score < 70
projscan ci --min-score 80 --format json  # JSON output for parsing
```

<img src="docs/npx%20projscan%20ci%20--min-score%2070.png" alt="npx projscan ci --min-score 70" width="700">

### GitHub Actions

Copy the included workflow template to your project:

```bash
cp .github/projscan-ci.yml .github/workflows/projscan.yml
```

This runs health checks on every push/PR and posts a markdown health report as a PR comment. See [`.github/projscan-ci.yml`](.github/projscan-ci.yml) for the full workflow.

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

A flat health score doesn't tell you what to do. **`projscan hotspots`** combines `git log` churn, file complexity (lines of code), open issues, and recency into a single risk score per file — so you know where refactoring or review will actually pay off.

```bash
projscan hotspots                       # Top 10 hotspots
projscan hotspots --limit 20
projscan hotspots --since "6 months ago"
projscan hotspots --format json         # Machine-readable for dashboards
projscan hotspots --format markdown     # Drop into a PR or tech-debt ticket
```

Hotspot ranking follows the classic Feathers "churn × complexity" heuristic, with boosts for files that currently fail `projscan doctor` or that changed recently. Falls back gracefully outside a git repo.

## AI Agent Integration (MCP)

**`projscan mcp`** starts an [MCP](https://modelcontextprotocol.io) server over stdio so AI coding agents can query projscan during a session. Tools exposed:

- `projscan_analyze` — full project report
- `projscan_doctor` — health score + issues
- `projscan_hotspots` — risk-ranked files (with `limit`, `since` args)
- `projscan_explain` — per-file purpose, imports, exports, smells
- `projscan_structure` — directory tree
- `projscan_dependencies` — package audit

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
