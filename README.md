<div align="center">

# projscan

[![npm version](https://img.shields.io/npm/v/projscan.svg)](https://www.npmjs.com/package/projscan)
[![license](https://img.shields.io/npm/l/projscan.svg)](https://github.com/abhiyoheswaran1/devlens/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/projscan.svg)](https://nodejs.org)

**Instant codebase insights — doctor, x-ray, and architecture map for any repository.**

[Install](#install) · [Quick Start](#quick-start) · [Commands](#commands) · [Full Guide](docs/GUIDE.md)

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
$ projscan doctor

Project Health Report
──────────────────────────────────────────

  Health Score: C (67/100)
  Found 3 warnings, 2 info

Issues Detected
──────────────────────────────────────────
  ⚠ No ESLint configuration
  ⚠ No Prettier configuration
  ⚠ No test framework detected
  ℹ Missing .editorconfig
  ℹ README is nearly empty

  Run projscan fix to auto-fix 4 issues.
```

And it doesn't just report problems — it **fixes them**:

```bash
$ projscan fix -y
✔ Installed ESLint with TypeScript support
✔ Installed Prettier with sensible defaults
✔ Installed Vitest with sample test
✔ Created .editorconfig
```

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
projscan fix        # Auto-fix detected issues
projscan diagram    # Architecture visualization
projscan structure  # Directory tree
```

For a comprehensive walkthrough, see the **[Full Guide](docs/GUIDE.md)**.

## Commands

| Command | Description |
|---------|-------------|
| `projscan analyze` | Full analysis — languages, frameworks, dependencies, issues |
| `projscan doctor` | Health check — missing tooling, architecture smells, risks |
| `projscan fix` | Auto-fix issues (ESLint, Prettier, Vitest, .editorconfig) |
| `projscan explain <file>` | Explain a file's purpose, imports, exports, and issues |
| `projscan diagram` | ASCII architecture diagram of your project |
| `projscan structure` | Directory tree with file counts |
| `projscan dependencies` | Dependency analysis — counts, risks, recommendations |
| `projscan badge` | Generate a health score badge for your README |

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

## Performance

- **5,000 files** analyzed in under 1.5 seconds
- **20,000 files** analyzed in under 3 seconds
- **Zero network requests** — everything runs locally
- **4 runtime dependencies** — minimal footprint

## Use Cases

- **Onboarding**: Understand any codebase in seconds, not hours
- **Code reviews**: Run `projscan doctor --format markdown` and paste into PRs
- **CI/CD**: Add health checks to your pipeline ([see guide](docs/GUIDE.md#cicd-integration))
- **Consulting**: Quickly assess client projects before diving in
- **Maintenance**: Regular health checks across multiple repositories

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
