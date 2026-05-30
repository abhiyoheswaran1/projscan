<div align="center">

# projscan

[![npm version](https://img.shields.io/npm/v/projscan.svg)](https://www.npmjs.com/package/projscan)
[![license](https://img.shields.io/npm/l/projscan.svg)](https://github.com/abhiyoheswaran1/projscan/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/projscan.svg)](https://nodejs.org)
[![projscan health](https://img.shields.io/badge/projscan-A-brightgreen)](#quick-start)

**Agent-first code intelligence.** An MCP server that lets AI coding agents (Claude Code, Codex, Cursor, Gemini, Windsurf, Cline, Continue, Zed — any MCP-aware client) query your codebase — with a CLI for humans and a local plugin layer for team-specific policy and reporting.

[AI Agent Quick Start](#ai-agent-integration-mcp) · [CLI Quick Start](#quick-start) · [Commands](#commands) · [Full Guide](https://github.com/abhiyoheswaran1/projscan/blob/v3.0.5/docs/GUIDE.md) · [Roadmap](https://github.com/abhiyoheswaran1/projscan/blob/v3.0.5/docs/ROADMAP.md)

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/projscan-reporter-plugin.png" alt="projscan reporter plugin running in a macOS-style terminal window with a team health summary" width="700">

</div>

---

## Why?

AI coding agents are becoming the primary interface to code. Today, when you ask your agent *"which files implement auth?"* or *"what breaks if I bump React from 18 to 19?"* - it either guesses from names, or it shells out to grep and reads raw output not built for it.

**projscan is the first code-intelligence tool built for agents, not for humans.** Your agent gets a fast, AST-accurate, context-budget-aware view of your codebase through structured MCP tools. It can run a preflight safety gate before edits or merge, including supply-chain IOC evidence, query a stable v3 semantic graph, detect bridge-helper dataflow risks, find symbol definitions, preview upgrades, rank hotspots, diff structural changes between refs, surface coupling/cycle hotspots, get an **intent-grounded** one-call PR review (now with new-taint-flow and bridge-dataflow detection that *blocks* unsafe merges, plus an optional natural-language intent arg that labels each finding expected / unexpected / out-of-scope), request structured fix-action prompts for any open issue and **mechanically apply** the safe ones with rollback, ask "what breaks if I change this?" via transitive blast-radius analysis (across registered sibling repos too), surface source-to-sink taint flows, share a durable session across multiple agent invocations, and learn from how you use it — quieting accumulated noise on this specific repo over time without ever phoning home.

The stable local plugin platform turns that same pipeline into a team substrate: analyzer plugins add project-specific findings, and reporter plugins render `doctor`, `analyze`, and `ci` in your team's own voice without changing the underlying scan.

The 3.0.5 loop focuses on the first useful team PR: `projscan init team` creates policy, CI, ownership, and baseline memory; `projscan evidence-pack --pr-comment` posts a compact verdict with trust calibration, top risks, a First Fix, owner routing, baseline trend memory, reviewer feedback prompts, and exact next commands; `projscan dogfood` checks whether that loop is ready across real repos.

Humans get the same thing through the CLI.

**Everything is offline-first. Zero network calls. No API keys.**

```bash
npx projscan
```

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/projscan-reporter-plugin.gif" alt="projscan doctor rendered through a local reporter plugin in a macOS-style terminal window" width="700">

Run `projscan doctor` for a focused health check:

```bash
npx projscan doctor
```

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/npx%20projscan%20doctor.gif" alt="npx projscan doctor" width="700">

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
projscan start                      # First-60-seconds workflow orientation
projscan first-run                  # First-run setup diagnostics for CLI + MCP
projscan init mcp --client all      # Ready-to-paste MCP client configs
projscan mcp doctor --client codex   # Verify MCP setup and paste config
projscan init policy --team security # Team policy starter .projscanrc.json
projscan init team --team security  # Policy + PR workflow + CODEOWNERS + baseline + first-PR checklist
projscan init github-action       # PR workflow with validated evidence comments + block enforcement
projscan recipes                    # Agent workflow recipes, including team bootstrap + PR automation
projscan workplan --mode bug_hunt   # Prioritized agent execution plan
projscan bug-hunt --format json     # Bug-hunt fix queue with verification commands
projscan agent-brief --intent bug_hunt   # Compact next-agent context packet
projscan quality-scorecard --format json # Dimensioned quality view
projscan release-train --format json          # Product readiness plan
projscan evidence-pack --website-prompt  # Approval packet with product evidence
projscan evidence-pack --pr-comment # PR comment with trust calibration + First Fix
projscan dogfood --repo ../api --repo ../web --format json # Multi-repo adoption proof loop
projscan regression-plan --level full    # Risk-based verification matrix
projscan handoff                    # Concise next-agent handoff
projscan handoff --write docs/agent-handoff.md # Persist next-agent handoff artifact
projscan preflight --format json    # Agent safety gate with supply-chain evidence
projscan doctor                     # Health check, including security and supply-chain risks
projscan hotspots                   # Rank files by risk (churn × complexity × issues × ownership)
projscan semantic-graph --format json # Stable v3 file/function/package/symbol graph
projscan dataflow --format json     # Focused direct, propagated, and bridge dataflow risks
projscan search <query>             # BM25-ranked search (content + symbols + path)
projscan file <path>                # Drill into a file - purpose, risk, ownership, issues
projscan fix                        # Auto-fix detected issues
projscan ci                         # CI health gate (exits 1 on low score)
projscan ci --changed-only          # Gate only on this PR's diff
projscan ci --format sarif          # SARIF 2.1.0 for GitHub Code Scanning
projscan outdated                   # Declared-vs-installed drift (offline)
projscan audit                      # npm audit, normalized + SARIF-ready
projscan upgrade <pkg>              # Preview upgrade impact (local CHANGELOG + importers)
projscan coverage                   # Coverage × hotspots - scariest untested files
projscan diff                       # Compare health + hotspot trends against a baseline
projscan diagram                    # Architecture visualization
projscan structure                  # Directory tree
projscan mcp                        # Run as an MCP server for AI coding agents
projscan plugin list                # Discover local analyzer/reporter plugins
projscan plugin init --kind analyzer --name policy
projscan plugin test .projscan-plugins/policy.projscan-plugin.json
PROJSCAN_PLUGINS_PREVIEW=1 projscan doctor --reporter team-radar
```

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/npx%20projscan%20--help.gif" alt="npx projscan --help" width="700">

For a comprehensive walkthrough, see the **[Full Guide](https://github.com/abhiyoheswaran1/projscan/blob/v3.0.5/docs/GUIDE.md)**.

## Commands

| Command | Description |
|---------|-------------|
| `projscan analyze` | Full analysis - languages, frameworks, dependencies, issues |
| `projscan start` | First-60-seconds workflow orientation with setup diagnostics, top risks, and next commands |
| `projscan first-run` | First-run setup diagnostics for Node, Git, config, plugins, and MCP startup |
| `projscan init mcp` | Ready-to-paste MCP client configs for popular agent clients |
| `projscan mcp doctor` | Verify MCP setup and print paste-ready client config with checks |
| `projscan init policy` | Team policy starter kits for frontend, platform, security, and monorepo teams |
| `projscan init team` | Bootstrap policy, PR workflow, CODEOWNERS starter, baseline memory, start report, and first-PR onboarding checklist |
| `projscan init github-action` | GitHub Actions PR workflow that validates and posts projscan evidence comments, then fails only on preflight blocks |
| `projscan recipes` | Agent workflow recipes for team bootstrap, PR automation, before edit, bug hunt, approval, handoff, and pre-merge |
| `projscan workplan` | Agent execution plan - prioritized tasks with evidence, tools, verification, and handoff text |
| `projscan bug-hunt` | Prioritized bug-hunt fix queue from doctor, preflight, and session evidence, with hotspot-only churn kept as a watchlist signal |
| `projscan agent-brief` | Compact next-agent context packet with focus items, guardrails, repo context, and next actions |
| `projscan quality-scorecard` | Dimensioned quality view with health, security, tests, maintainability, coordination, and top risks |
| `projscan release-train` | Plan upcoming product lines with readiness evidence |
| `projscan evidence-pack` | Assemble approval evidence from planning, bug-hunt, workplan, preflight, trust calibration, First Fix, owner routing, and baseline trend memory |
| `projscan dogfood` | Evaluate 1+ real repos for PR-comment readiness, repeat-use readiness, MCP readiness, and reviewer feedback prompts |
| `projscan regression-plan` | Build a smoke, focused, or full regression matrix from product risk signals |
| `projscan handoff` | Concise next-agent handoff from the current workplan |
| `projscan doctor` | Health check - missing tooling, architecture smells, security and supply-chain risks |
| `projscan preflight` | Agent safety gate - `proceed`, `caution`, or `block` with health, change, plugin, and supply-chain evidence |
| `projscan hotspots` | Rank files by risk - churn × complexity × issues × ownership |
| `projscan semantic-graph` | Stable v3 graph contract - files, functions, packages, symbols, imports, exports, definitions, and calls |
| `projscan dataflow` | Focused direct, propagated, and bridge source-to-sink dataflow risks |
| `projscan search <query>` | **BM25-ranked search** - content + symbols + path, with excerpts |
| `projscan file <path>` | Drill into a file - purpose, risk, ownership, related issues |
| `projscan fix` | Auto-fix issues (ESLint, Prettier, Vitest, .editorconfig) |
| `projscan ci` | CI health gate - SARIF output, `--changed-only` PR-diff mode, exits 1 if score below threshold |
| `projscan diff` | Compare current health **and hotspot trends** against a baseline |
| `projscan explain <file>` | Explain a file's purpose, imports, exports, and issues |
| `projscan diagram` | ASCII architecture diagram of your project |
| `projscan structure` | Directory tree with file counts |
| `projscan dependencies` | Dependency analysis - counts, risks, recommendations |
| `projscan outdated` | Declared-vs-installed drift check (offline) |
| `projscan audit` | `npm audit`-powered vulnerability report - SARIF-ready for Code Scanning |
| `projscan upgrade <pkg>` | Preview upgrade impact - local CHANGELOG + importer list, offline |
| `projscan coverage` | **Coverage × hotspots - rank the scariest untested files** (`--changed-only` for diff mode) |
| `projscan badge` | Generate a health score badge for your README |
| `projscan init` | *(1.6)* Scaffold `.projscanrc.json` with sensible defaults |
| `projscan install-hook` | *(1.6)* Install a `pre-commit` hook running `projscan ci --changed-only` |
| `projscan workspace` | *(1.6)* Register sibling repos for cross-repo intelligence (`add` / `list` / `remove`) |
| `projscan apply-fix <id>` | *(1.6)* Mechanically execute the safe fix templates with rollback (default dry-run) |
| `projscan taint` | *(1.6)* Source-to-sink reachability over the call graph |
| `projscan plugin` | Discover, scaffold, validate, and test local analyzer/reporter plugins |
| `projscan mcp` | Run as an MCP server for AI coding agents (Claude Code, Codex, Cursor, Gemini, Windsurf, …) |

To see all commands and options, run:

```bash
projscan --help
```

### Command Screenshots

<details>
<summary><strong>projscan structure</strong> - Directory tree with file counts</summary>

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/npx%20projscan%20structure.gif" alt="npx projscan structure" width="700">
</details>

<details>
<summary><strong>projscan diagram</strong> - Architecture visualization</summary>

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/npx%20projscan%20diagram.gif" alt="npx projscan diagram" width="700">
</details>

<details>
<summary><strong>projscan dependencies</strong> - Dependency analysis</summary>

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/npx%20projscan%20dependencies.gif" alt="npx projscan dependencies" width="700">
</details>

<details>
<summary><strong>projscan explain</strong> - File explanation</summary>

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/npx%20projscan%20explain.gif" alt="npx projscan explain" width="700">
</details>

<details>
<summary><strong>projscan badge</strong> - Health badge generation</summary>

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/npx%20projscan%20badge.gif" alt="npx projscan badge" width="700">
</details>

### Output Formats

Commands accept `--format` for different output targets. Supported formats are command-dependent; unsupported combinations fail clearly instead of falling back to another renderer.

```bash
projscan analyze --format json       # Machine-readable JSON
projscan analyze --format html       # Self-contained HTML report
projscan doctor --format markdown    # Markdown for docs/PRs
projscan ci --format sarif           # SARIF 2.1.0 for GitHub Code Scanning
```

Formats: `console` (default), `json`, `markdown`, `sarif`, `html`

Run `projscan help` for the generated command-by-command support matrix.

### Plugin Platform

projscan can load local plugins from `.projscan-plugins/` when `PROJSCAN_PLUGINS_PREVIEW=1` is set. The environment flag is kept for explicit local-code opt-in. Analyzer plugins emit normal projscan issues; reporter plugins render supported CLI commands with team-specific output.

**2.0 upgrade notes:** migrating from 1.x or authoring plugins? Start with the [2.0 Migration Guide](https://github.com/abhiyoheswaran1/projscan/blob/v3.0.5/docs/2.0-MIGRATION.md), then use [Plugin Authoring](https://github.com/abhiyoheswaran1/projscan/blob/v3.0.5/docs/PLUGIN-AUTHORING.md), the [Plugin Gallery](https://github.com/abhiyoheswaran1/projscan/blob/v3.0.5/docs/PLUGIN-GALLERY.md), and the [manifest schema](https://github.com/abhiyoheswaran1/projscan/blob/v3.0.5/docs/plugin.schema.json) as the stable contract.

```bash
projscan plugin list
projscan plugin validate .projscan-plugins/team-radar.projscan-plugin.json
PROJSCAN_PLUGINS_PREVIEW=1 projscan doctor --reporter team-radar
PROJSCAN_PLUGINS_PREVIEW=1 projscan ci --reporter team-radar --min-score 80
```

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/projscan-reporter-plugin.gif" alt="projscan local reporter plugin rendering a team health report" width="700">

Reporter plugins are intentionally CLI-only. MCP tools keep returning structured JSON-compatible payloads so agents can reason over stable data, while humans can get a polished local report for their team. Custom presentation, team-branded summaries, and white-label reports belong in reporter plugins rather than new core HTML theming flags. See [Plugin Authoring](https://github.com/abhiyoheswaran1/projscan/blob/v3.0.5/docs/PLUGIN-AUTHORING.md) for manifest shape, `render(context)`, validation, and the trust model.

### Options

| Flag | Description |
|------|-------------|
| `--format <type>` | Output format: console, json, markdown, sarif, html (command-dependent) |
| `--config <path>` | Path to a `.projscanrc` config file |
| `--changed-only` | Scope to files changed vs base ref (ci/analyze/doctor) |
| `--base-ref <ref>` | Git base ref for `--changed-only` (default: origin/main) |
| `--reporter <name>` | Render `doctor`, `analyze`, or `ci` with a local reporter plugin |
| `--verbose` | Enable debug output |
| `--quiet` | Suppress non-essential output |
| `-V, --version` | Show version |
| `-h, --help` | Show help |

## Health Score

Every `projscan doctor` run calculates a health score (0–100) and letter grade:

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90–100 | Excellent - project follows best practices |
| B | 80–89 | Good - minor improvements possible |
| C | 70–79 | Fair - several issues to address |
| D | 60–69 | Poor - significant issues found |
| F | < 60 | Critical - major issues need attention |

Generate a badge for your README:

```bash
projscan badge
```

This outputs a [shields.io](https://shields.io) badge URL and markdown snippet you can paste into your README.

**Sample badge:** [![projscan health](https://img.shields.io/badge/projscan-D-orange)](https://github.com/abhiyoheswaran1/projscan)

## What It Detects

**Languages**: TypeScript, JavaScript, Python, Go, Java, Ruby, Rust, PHP, C#, Kotlin, Swift, and C++ (full AST analysis for all 11), plus file-level detection for C, Dart, Lua, Scala, R, Shell, CSS, HTML, SQL, and more.

**Frameworks**: React, Next.js, Vue, Nuxt, Svelte, Angular, Express, Fastify, NestJS, Vite, Tailwind CSS, Prisma, and more

### Python (0.10)

Python repos now get the same treatment JS/TS has had since 0.6:

- **AST-accurate import graph.** `from pkg.mod import x`, relative imports, `__init__.py` packages, `__all__`. Parsed via tree-sitter-python (wasm, offline).
- **Python-aware analyzers.** Missing pytest / ruff / black config. Deprecated packages (nose, simplejson, pycrypto). Unused `pyproject.toml` / `requirements.txt` deps. Missing lockfile.
- **Code search.** BM25 and semantic modes work on `.py` files out of the box.
- **Hotspots + dead code.** Same scoring as JS/TS, with `__init__.py` and pytest test-file conventions understood.
- **MCP tools work unchanged.** `projscan_graph`, `projscan_search`, `projscan_doctor`, `projscan_hotspots`, etc. all accept Python projects. Agents can ask "which files import `pkg.core`?" and get an answer in milliseconds.

`projscan_upgrade` remains Node-only for now - a Python equivalent (reading pip / poetry metadata) is on the roadmap.

### Go (0.11)

Go flows through the same pipeline as JS/TS and Python:

- **AST-accurate import graph** via tree-sitter-go. Single-line and parenthesized import blocks, aliased imports, dot-imports.
- **Capitalization-rule export visibility** - uppercase identifiers are public, lowercase are private. Captures `func`, method, `var`, `const`, `type` (struct/interface).
- **`go.mod` module-path resolution** - imports prefixed with the module path resolve into the repo; stdlib and third-party are external.
- **Cyclomatic complexity** counted from `if`, `for`, `switch` cases, select communication cases, `&&`/`||`. Default cases and `defer`/`go` don't count.

### Coupling and cycles (0.11)

`projscan coupling` (CLI + MCP tool) reports per-file fan-in / fan-out / instability (Bob Martin's I = Ce / (Ca + Ce)) and detects circular imports via Tarjan SCC. Cross-package edges are flagged when running on a monorepo.

### PR-aware structural diff (0.11)

`projscan pr-diff` returns the structural diff between two refs: exports added/removed/renamed, imports added/removed, call sites added/removed, ΔCC, Δfan-in. Spins up a temporary git worktree at the base ref to build a clean second graph. Renames are detected via similarity scoring (max of normalized Levenshtein and shared-affix fraction, threshold 0.5).

### Monorepo support (0.11)

Detects npm/yarn workspaces, `pnpm-workspace.yaml`, Lerna, modern Nx (`nx.json#workspaceLayout` + `project.json` scan), legacy Nx (`workspace.json#projects`), and a `packages/*` + `apps/*` + `libs/*` fallback. `projscan workspaces` lists every package; `--package <name>` (or the `package` MCP arg) scopes most commands to a single workspace.

Cache version bumped 2 → 3 in 0.11 (CC stored per file). Existing v2 caches are discarded on first run and rebuilt automatically.

## Performance

Reference numbers from `npm run bench` on an Apple M3 Pro running Node 25 (cold / warm cache, milliseconds), refreshed for 1.5.0:

| Repo | Files | analyze | doctor | hotspots | coupling | search |
|------|-------|---------|--------|----------|----------|--------|
| projscan itself | ~120 | 650 / 576 | 659 / 574 | 794 / 622 | 405 / 186 | 485 / 277 |
| Synthetic medium | 500 | 284 / 257 | 277 / 255 | 300 / 278 | 224 / 177 | 239 / 196 |

For real-world numbers against larger codebases, `npm run bench:references` shallow-clones TypeScript, Django, and kubernetes/client-go into `.bench-cache/` (gitignored) and runs the same suite. First run is network-bound; later runs reuse the cache. Restrict to one target with `-- --only ts|django|k8s-client-go`.

Run `npm run bench` against your own machine to recalibrate.

- **Zero network requests** — everything runs locally
- **14 runtime dependencies** — still minimal
- **~21 MB of vendored tree-sitter grammars**, broken down:

| Grammar | Size | Languages |
|---|---:|---|
| `web-tree-sitter` | ~190 KB | runtime, all tree-sitter languages |
| `tree-sitter-python` | ~450 KB | Python |
| `tree-sitter-go` | ~210 KB | Go |
| `tree-sitter-java` | ~405 KB | Java |
| `tree-sitter-ruby` | ~2.0 MB | Ruby |
| `tree-sitter-rust` | ~1.1 MB | Rust |
| `tree-sitter-php` | ~785 KB | PHP |
| `tree-sitter-c-sharp` | ~5.2 MB | C# |
| `tree-sitter-cpp` | ~3.3 MB | C, C++ |
| `tree-sitter-kotlin` | ~3.9 MB | Kotlin |
| `tree-sitter-swift` | ~3.6 MB | Swift |

JavaScript and TypeScript use the bundled `@babel/parser` instead of a tree-sitter grammar, so they don't appear in this table.

## Optional features

projscan keeps the install slim by default. One feature is gated behind an optional peer dependency:

- **Semantic search** uses local embeddings via `@xenova/transformers` (~25 MB quantized model, downloads on first use, then cached). Without it, `projscan search` falls back to BM25 lexical search and prints a one-line tip pointing here. Install when you want it:

  ```bash
  npm install @xenova/transformers
  projscan search "cache invalidation" --semantic
  ```

  See [AI Agent Integration → Semantic search](#semantic-search-090-opt-in) for details.

## Security & trust

projscan reads your source code so it can be useful; it does not send your source code anywhere. This section explains exactly what's happening, because supply-chain scanners (Socket, Snyk, npm audit, etc.) will flag a few patterns in any tool that wraps `git` and `npm`, and we want you to be able to verify our claims rather than trust them.

### What projscan does NOT do

- **Send your source code off-machine.** Zero network calls in any code path projscan owns. File contents stay local; AST analysis runs in-process.
- **Read environment variables for secrets.** `process.env` is forwarded to child processes (`git`, `npm`) so they can find their `PATH` — we never inspect `.env` values, API keys, or session tokens.
- **Execute command-line arguments as code.** Core CLI and MCP arguments are parsed as data, and projscan does not compose shell strings from user input. Local plugins are the explicit trust boundary: when `PROJSCAN_PLUGINS_PREVIEW=1` is set, projscan imports local modules declared in `.projscan-plugins/*.projscan-plugin.json` and runs their `check` / `render` exports.
- **Phone home with telemetry.** The opt-in JSONL telemetry shipped in 0.11 was removed entirely in 0.12. Future telemetry, if any, will be remote-sink-with-dashboard and explicitly opt-in.
- **Modify your repo without an explicit command.** `projscan fix` is the only command that writes to source files, and only when invoked. The cache directory `.projscan-cache/` is local-only and gitignored.

### What projscan DOES do, and what it costs

| Action | When | Network? | Notes |
|---|---|---|---|
| Read source files | every command | no | parses with tree-sitter / Babel; results cached at `.projscan-cache/` |
| Spawn `git` | `hotspots`, `pr-diff`, `review`, `diff` | git itself may fetch if you run `git fetch` separately; **projscan never invokes `git fetch`** | `env: process.env` is passed so `git` can find its config |
| Spawn `npm audit` | `audit` only | yes — by `npm`, not by projscan | runs against your local lockfile |
| Scan supply-chain IOCs | `doctor`, `preflight`, release validation | no | checks manifests, lockfiles, hidden editor hooks, and suspicious install-time payloads against bundled indicators |
| Load local plugins | only with `PROJSCAN_PLUGINS_PREVIEW=1` | no | imports local JS modules declared in `.projscan-plugins/`; only enable plugins you trust |
| Load wasm grammars | first parse of a non-JS file | no | served from `dist/grammars/` inside the package; no fetch |
| Build embeddings | semantic search opt-in only | yes — by `@xenova/transformers`, on first use | model cached locally after first download; remove the peer dep to remove this code path entirely |

### Patterns supply-chain scanners flag, and why they're benign here

If you read projscan's [Socket report](https://socket.dev/npm/package/projscan), you'll see four supply-chain alerts. Here's a one-line answer to each:

- **"Network access"** — comes from `web-tree-sitter`'s internal API surface; we feed it local wasm files at `dist/grammars/`. No outbound traffic.
- **"Dynamic require" / runtime import** — optional dependencies lazy-load from literal module names; opt-in local plugins load validated manifest module paths under `.projscan-plugins/`. Plugin execution is local code execution by design, gated by `PROJSCAN_PLUGINS_PREVIEW=1`.
- **"Environment variable access"** — `env: process.env` is forwarded to child processes (`git`, `npm audit`). We don't read env contents.
- **"URL strings"** — the strings are documentation references (`github.com`, `registry.npmjs.org`) shown in error messages and CHANGELOGs, not runtime fetch targets.

### Audit it yourself

- **Source is open** at [github.com/abhiyoheswaran1/projscan](https://github.com/abhiyoheswaran1/projscan). The npm tarball matches the `dist/` produced by `npm run build` at the matching tag.
- **Public API surface is locked** by `scripts/check-stability.mjs`, which runs in CI on every PR and fails on any rename or removal of an MCP tool, CLI command, or exit code. See [`docs/STABILITY.md`](https://github.com/abhiyoheswaran1/projscan/blob/v3.0.5/docs/STABILITY.md).
- **Run it offline:** `npm install -g projscan` followed by anything except `audit` and `--mode semantic` works without network.
- **Drop privilege further:** in CI, run projscan in a sandbox that disallows network egress; everything except `audit` will pass.

## Dogfooding

projscan runs against itself in CI on every PR. The dogfood loop is the most direct evidence we can offer that the tool works on real code, not just synthetic fixtures.

```sh
# .github/workflows/ci.yml — runs after the unit tests
- run: node dist/cli/index.js ci --min-score 90
```

Current state of the projscan codebase as scored by projscan itself:

| Metric | Value |
|---|---|
| Health score | **A (100 / 100)** |
| Open issues | 0 errors, 0 warnings, 0 info |
| Circular imports | 0 |
| Top hotspot | `src/reporters/consoleReporter.ts` (CC 288, 1108 lines) — known refactor candidate, not a defect |
| Dogfood threshold | `--min-score 90` (CI fails below this) |

The `--min-score 90` threshold is deliberately tight: a regression that drops the score by more than ten points fails the build. The current ten-point margin (90 → 100) is for room to breathe, not slack.

For adoption proof, run the product against multiple real repos and capture first-PR feedback:

```sh
projscan dogfood --repo ../api --repo ../web --repo ../worker --format json
projscan evidence-pack --pr-comment
```

The dogfood report checks PR-comment readiness, repeat-use commands, MCP readiness, and the exact feedback questions a reviewer should answer before rollout.

The hotspots projscan finds in itself are real signals — the reporters in particular have grown organically across releases and are candidates for a 2.0-era refactor (tracked in `docs/ROADMAP.md` "Under consideration"). We choose to ship the signal honestly rather than tune the score to hide it.

## CI/CD Integration

Use `projscan ci` to gate your pipelines:

```bash
projscan ci --min-score 70                     # Exits 1 if score < 70
projscan ci --min-score 80 --format json       # JSON output for parsing
projscan ci --changed-only                     # Gate only on this PR's diff
projscan ci --format sarif > projscan.sarif    # SARIF for Code Scanning
```

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/npx%20projscan%20ci%20--min-score%2070.gif" alt="npx projscan ci --min-score 70" width="700">

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
      - uses: abhiyoheswaran1/projscan@v1
        with:
          min-score: '70'
          changed-only: 'true'
```

Inputs: `min-score`, `changed-only`, `base-ref`, `config`, `sarif-file`, `upload-sarif`, `working-directory`, `version`. Outputs: `score`, `grade`.

Findings appear in the **Security → Code scanning** tab, annotated on files and lines. PRs get inline annotations on changed lines.

### Plain workflow (no SARIF upload)

If you'd rather not upload SARIF, [`.github/projscan-ci.yml`](.github/projscan-ci.yml) is a drop-in workflow that runs projscan and posts a markdown health report as a PR comment.

## Configuration (`.projscanrc`)

Drop a `.projscanrc.json` at your repo root to set defaults - CLI flags always win over config. A `"projscan"` key in `package.json` and plain `.projscanrc` are also supported.

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

- `minScore` - default `ci` threshold (0–100)
- `baseRef` - default base ref for `--changed-only`
- `ignore` - extra glob patterns added to the built-in ignore list
- `disableRules` - silence rules by id; supports wildcard `prefix-*`
- `severityOverrides` - remap a rule's severity (`info` / `warning` / `error`)
- `hotspots.limit` / `hotspots.since` - defaults for the `hotspots` command
- `monorepo.importPolicy` - cross-package import allow/deny rules in monorepos *(0.14+)*

See [`docs/GUIDE.md` → Configuration](https://github.com/abhiyoheswaran1/projscan/blob/v3.0.5/docs/GUIDE.md#configuration-projscanrc) for the full reference (field types, validation behavior, embedding config in `package.json`, monorepo `importPolicy` semantics).

## Tracking Health Over Time

Save a baseline and compare later:

```bash
projscan diff --save-baseline       # Save current score
# ... make changes ...
projscan diff                       # Compare against baseline
projscan diff --format markdown     # Markdown diff for PRs
```

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/npx%20projscan%20diff%20--save-baseline.gif" alt="npx projscan diff --save-baseline" width="700">

## Hotspots - Where to Fix First

A flat health score doesn't tell you what to do. **`projscan hotspots`** combines `git log` churn, file complexity, open issues, recency, and **ownership** into a single risk score per file - so you know where refactoring or review will actually pay off.

<img src="https://abhiyoheswaran.com/images/projscan/hotspots-poster.png" alt="projscan hotspots output ranking files by composite risk score" width="700">

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

Combines the file's purpose, imports, exports, hotspot risk, ownership, and every open issue that references it - the natural follow-up to `projscan hotspots`.

### Track Trends Over Time

```bash
projscan diff --save-baseline           # Snapshots health + hotspots
# ...time passes, commits happen...
projscan diff                           # Shows which hotspots rose / fell
```

The baseline file now captures top hotspots too, so `diff` surfaces files that are **getting worse** (not just new issues).

## Dependency Health

projscan ships three focused commands for keeping your dependency graph healthy - all **offline** by default, no registry calls.

```bash
projscan outdated                       # Which declared deps drift from what's installed?
projscan outdated --format json         # Machine-readable drift report
projscan audit                          # Wrap npm audit; normalized, SARIF-ready
projscan audit --format sarif > a.sarif # Upload to GitHub Code Scanning
projscan upgrade chalk                  # What breaks if I bump chalk? Who imports it?
projscan upgrade chalk --format markdown # Paste-ready review comment
```

### What each one tells you

- **`outdated`** - reads `package.json` and `node_modules/<pkg>/package.json` to classify drift (`major` / `minor` / `patch` / `same` / `unknown`). No network.
- **`audit`** - wraps `npm audit --json`, normalizes the output, and emits SARIF with per-finding rules anchored to `package.json`. Graceful fallback message for yarn/pnpm projects.
- **`upgrade <pkg>`** - reads `node_modules/<pkg>/CHANGELOG.md`, slices the section between your installed version and the previous one, flags `BREAKING CHANGE` / `deprecated` / `removed support` markers, and lists every file in your repo that imports the package. All offline.

### Unused dependencies (automatic in `doctor`)

`projscan doctor` now flags declared dependencies that are never imported from source. Each finding is anchored to the **exact line in `package.json`** so GitHub Code Scanning PR annotations land in the right place.

Implicit-use packages (typescript, eslint/prettier plugins, `@types/*`, and anything invoked from a `package.json` script) are allowlisted. Override via `.projscanrc` → `disableRules` if projscan flags something that is used but not imported.

## Coverage × Hotspots - Scariest Untested Files

`projscan coverage` joins your test coverage with the hotspot ranking. A file with high churn and low coverage is where a bug is most likely to bite you - so that's where you want tests first.

```bash
projscan coverage                       # Top 30 scariest untested files
projscan coverage --format markdown     # Paste into a tech-debt ticket
projscan coverage --format json         # Machine-readable for dashboards
```

**How it decides "scariest":** `priority = riskScore × (0.3 + 0.7 × uncoveredFraction)` - so a file with 50 risk and 10% coverage outranks a file with 50 risk and 95% coverage.

**Which coverage files are supported:**

- `coverage/lcov.info` (lcov - Vitest, Jest, c8)
- `coverage/coverage-final.json` (Istanbul per-file detail)
- `coverage/coverage-summary.json` (Istanbul summary)

Coverage is also automatically joined into `projscan hotspots` when one of those files exists - no flag needed. Uncovered churning files get a score bump and a `low coverage (X%)` reason tag.

### Dead-code detection (automatic in `doctor`)

`projscan doctor` now flags source files whose exports nothing imports - dead code left over from refactors or utilities that were never wired up. Respects `package.json` public entry points (`main`, `exports`, `bin`, `types`), skips test files and barrel (`index`) files.

## AI Agent Integration (MCP)

**This is the primary way to use projscan.** `projscan mcp` starts an [MCP](https://modelcontextprotocol.io) server over stdio so AI coding agents can query your codebase with real structural accuracy - not regex, not grep.

<img src="https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v3.0.5/docs/projscan-agent-demo.gif" alt="projscan answering two agent questions: what breaks if I rename buildCodeGraph (impact analysis with definitions, direct callers, transitive reach), and where should I fix first (ranked hotspots with cyclomatic complexity)" width="700">

Two questions an agent asks; structural answers in milliseconds. *"What breaks if I rename `buildCodeGraph`?"* → 31 direct callers, 97 files reachable. *"Where should I fix first?"* → ranked hotspots with AST cyclomatic complexity, churn, and ownership signals.

### Claude Code

One-liner — adds projscan as an MCP server in the current project:

```bash
claude mcp add projscan -- npx -y projscan mcp
```

### Codex CLI (OpenAI)

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.projscan]
command = "npx"
args = ["-y", "projscan", "mcp"]
```

Restart `codex` and the tool surface (`projscan_graph`, `projscan_review`, …) appears alongside Codex's built-ins.

### Gemini CLI (Google)

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "projscan": {
      "command": "npx",
      "args": ["-y", "projscan", "mcp"]
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project):

```json
{
  "mcpServers": {
    "projscan": {
      "command": "npx",
      "args": ["-y", "projscan", "mcp"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "projscan": {
      "command": "npx",
      "args": ["-y", "projscan", "mcp"]
    }
  }
}
```

### Cline (VS Code extension)

In Cline's MCP settings panel (or the underlying `cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "projscan": {
      "command": "npx",
      "args": ["-y", "projscan", "mcp"]
    }
  }
}
```

### Continue.dev

Add to `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: projscan
    command: npx
    args:
      - -y
      - projscan
      - mcp
```

### Zed

Add to `~/.config/zed/settings.json` under `context_servers`:

```json
{
  "context_servers": {
    "projscan": {
      "command": {
        "path": "npx",
        "args": ["-y", "projscan", "mcp"]
      }
    }
  }
}
```

### Any other MCP-aware client

The transport is **stdio**. Wire your client to invoke `npx -y projscan mcp` as a subprocess; the server speaks JSON-RPC 2.0 over stdin/stdout. If your client wants `notifications/file_changed` push notifications when the repo changes, append `--watch`:

```bash
npx -y projscan mcp --watch
```

Capability is advertised under `experimental.fileChanged` on `initialize` so clients can detect support.

### What agents can ask

- *"Who imports `src/auth/jwt.ts`?"* → `projscan_graph { file, direction: "importers" }`
- *"Give me the whole agent-safe graph contract."* → `projscan_semantic_graph`
- *"Did this wrapper connect a source reader to a dangerous sink?"* → `projscan_dataflow`
- *"Where is `runAudit` defined?"* → `projscan_search { query: "runAudit", scope: "symbols" }`
- *"Which files implement auth?"* → `projscan_search { query: "auth", scope: "content" }`
- *"What are the scariest untested files?"* → `projscan_coverage`
- *"What breaks if I bump chalk to 6?"* → `projscan_upgrade { package: "chalk" }`
- *"Where should I refactor first?"* → `projscan_hotspots`
- *"What should my agent do first in this repo?"* → `projscan_start { mode: "before_edit" }`
- *"What should my agent do next?"* → `projscan_workplan { mode: "bug_hunt" }`
- *"Give the next agent a compact brief."* → `projscan_agent_brief { intent: "bug_hunt" }`
- *"Show the product quality picture."* → `projscan_quality_scorecard`
- *"What should I fix before a big release?"* → `projscan_bug_hunt`
- *"What evidence do I need before approval?"* → `projscan_evidence_pack { website_prompt: true }`
- *"Which checks prove this bigger product update?"* → `projscan_regression_plan { level: "full" }`
- *"How do I plan the next six product lines?"* → `projscan_release_train`
- *"How do I wire projscan into this MCP client?"* → `projscan_adoption { action: "mcp_config", client: "codex" }`

### The 40 MCP tools

**Structural (0.6.0 / 0.11 / 0.13 / 0.14 / 0.15 - agent-native):**
- **`projscan_start`** *(3.0.4)* - first-60-seconds repo orientation. Composes setup diagnostics, workflow recipes, workplan, quality scorecard, top risks, adoption gaps, next commands, and optional handoff payload.
- **`projscan_graph`** - query the AST-based code graph. Directions: `imports`, `exports`, `importers`, `symbol_defs`, `package_importers`. Millisecond responses on a warm cache.
- **`projscan_semantic_graph`** *(3.0)* - stable v3 semantic graph contract with file, function, package, and symbol nodes plus `defines`, `imports`, `imports_package`, `exports`, and `calls` edges.
- **`projscan_dataflow`** *(3.0)* - focused direct, propagated, and bridge source-to-sink dataflow risks. Next.js and Express request sources are framework-aware, DB/write sinks are receiver-sensitive, and defaults suppress test-file paths, broad readFile/writeFile noise, JavaScript RegExp.exec false positives, and generated-code anxiety; opt into broader scans with `include_tests` / `include_broad_file_io` / `include_generated` or the matching CLI flags.
- **`projscan_search`** - fast search across `symbols` (exported names), `files` (path substring), or `content` (source substring with line + excerpt). Sub-file mode (`sub_file: true`) embeds per-function for sharper semantic results *(0.15)*.
- **`projscan_coupling`** *(0.11)* - per-file fan-in / fan-out / instability + circular-import cycles (Tarjan SCC). Filter by `direction: cycles_only | high_fan_in | high_fan_out`.
- **`projscan_pr_diff`** *(0.11)* - structural diff between two git refs. Returns added/removed/modified files with explicit lists of exports, imports, and call sites that changed, plus ΔCC and Δfan-in.
- **`projscan_review`** *(0.13)* - one-call PR review. Composes `pr_diff` + per-changed-file risk + new/expanded import cycles + risky function additions + dependency changes + a verdict (`ok` / `review` / `block`).
- **`projscan_workplan`** *(2.3)* - agent mission-control plan. Composes preflight, review, session, hotspot, plugin, and supply-chain evidence into prioritized tasks with verification commands and handoff text.
- **`projscan_bug_hunt`** *(2.3)* - ranked bug-hunt queue. Composes doctor issues, preflight, hotspots, and session coordination into fix targets with verification commands.
- **`projscan_release_train`** *(2.3)* - product-line readiness planner. Reads version, scope, readiness evidence, and next actions.
- **`projscan_evidence_pack`** *(2.3)* - approval packet. Composes planning, bug-hunt, workplan, preflight, changelog, optional website prompt evidence, and PR comments with trust calibration, First Fix, owner routing, baseline trend memory, and exact next commands.
- **`projscan_regression_plan`** *(2.3)* - smoke/focused/full regression matrix. Turns bug-hunt, preflight, and product risk into deduplicated verification commands.
- **`projscan_agent_brief`** *(2.3)* - compact next-agent context packet with focus items, repo context, guardrails, and suggested next actions.
- **`projscan_quality_scorecard`** *(2.3)* - dimensioned quality view across health, security, tests, maintainability, coordination, top risks, and verification commands.
- **`projscan_adoption`** *(2.9)* - adoption helper for MCP config snippets, workflow recipes, and first-run diagnostics.
- **`projscan_fix_suggest`** *(0.14)* - structured action prompt for any open issue: headline, why it matters, where, one-paragraph instruction, optional suggested test. Closes the diagnose → fix loop.
- **`projscan_explain_issue`** *(0.14)* - deep dive on one issue: code excerpt, related issues in the same file, similar past commits via `git log --grep`, plus the structured FixSuggestion.
- **`projscan_impact`** *(0.15)* - transitive blast-radius for a file or symbol. BFS over reverse imports + symbol callsites. Use BEFORE renaming or deleting to see what breaks.

**Analysis:**
- `projscan_analyze` - full project report
- `projscan_doctor` - health score + issues (now includes `cycle-detected-N` for circular imports as of 0.13)
- `projscan_hotspots` - risk-ranked files (churn × **AST cyclomatic complexity** × issues × ownership × coverage; falls back to LOC for non-AST languages). Pass `view: "functions"` *(0.13)* for top-N risky individual functions.
- `projscan_file` - per-file risk + ownership + related issues + CC + fan-in/fan-out + per-function CC table *(0.13)*
- `projscan_explain` - per-file purpose, imports, exports, smells
- `projscan_structure` - directory tree
- `projscan_coverage` - scariest untested files (coverage × hotspots)

**Dependencies:**
- `projscan_dependencies` - declared deps, risks. In a monorepo: aggregated totals + `byWorkspace` breakdown; `package` arg scopes to one *(0.13)*.
- `projscan_outdated` - declared-vs-installed drift (offline). Per-package `byWorkspace`; `package` arg.
- `projscan_audit` - normalized `npm audit`. `package` arg scopes findings to one workspace's direct deps *(0.13)*.
- `projscan_upgrade` - upgrade preview (CHANGELOG + importers, offline)

**Workspace (0.11):**
- `projscan_workspaces` - list monorepo packages (npm/yarn/pnpm/Nx/Turbo/Lerna). Use the `name` as the `package` arg on `projscan_hotspots` / `projscan_coupling` to scope.

**Session (1.4):**
- **`projscan_session`** *(1.4)* - durable cross-invocation session. Subactions: `current` (id + counts), `touched` (files touched this session, sorted by recency, filterable by source: `tool-result` / `fs-watch` / `explicit`), `events` (chronological log), `reset` (start a fresh session). Auto-populated from every tool result and from `notifications/file_changed` push events when `--watch` is on. Lets multiple agents in the same project see "what's been touched here" without re-running git.

**Memory (1.5):**
- **`projscan_memory`** *(1.5)* - durable, local-only feedback loop. Records, per analyzer rule id, how many runs surfaced it and how many fixed it. Subactions: `current` (aggregate counts), `stable` (rules surfaced across ≥ 3 runs over ≥ 7 days without ever being fixed — paired with a ready-to-paste `.projscanrc.json disableRules` snippet), `runs` (every tracked rule with full history), `forget` (drop a single rule). Stored at `.projscan-memory/memory.json`; never leaves the machine. Lets an agent ask "what is this project tolerating?" and propose quieting it.

**Operator (1.6):**
- **`projscan_workspace_graph`** *(1.6)* - cross-repo intelligence over sibling repos registered with `projscan workspace add`. Subactions: `list` (registered repos + parsed-file + export counts), `graph` (every symbol exported by ≥ 2 repos — the candidate refactor / API contract surface), `file_importers` (given a file in one repo, every other repo whose graph imports it). Read-only.
- **`projscan_apply_fix`** *(1.6)* - mechanically execute the safe fix templates. Default is dry-run; pass `confirm: true` to write. Atomic writes, per-apply rollback record at `.projscan-cache/rollbacks/<id>.json`. Reverse with `action: "rollback", rollback_id: ...`. Six templates supported at this release: `unused-dependency-*`, `missing-test-framework`, `missing-eslint`, `missing-prettier`, `missing-editorconfig`, `missing-readme`.
- **`projscan_taint`** *(1.6)* - source-to-sink reachability over the per-function call graph. Built-in defaults cover common JS / Python sources (`process.env`, `req.body`, etc.) and sinks (`exec`, `eval`, `db.query`, etc.). Project-specific names go in `.projscanrc.json` `taint`. `projscan_review` automatically diffs taint flows between base and head and **blocks any PR that introduces a new flow**. In 3.0.2, review surfaces hardened `newDataflowRisks`, compact `graphEvidence`, and graph-readiness gates for safer handoff.

Analyzer plugins can optionally read graph/dataflow context through `check(rootPath, files, context)` while staying on manifest schema v1. The packaged `graph-context` example shows `context.getSemanticGraph()` and `context.getDataflow()` in a real analyzer. For analyzer and reporter plugin authoring, manifest validation, `--reporter <name>`, and the trust model, see [Plugin Authoring](https://github.com/abhiyoheswaran1/projscan/blob/v3.0.5/docs/PLUGIN-AUTHORING.md).

### Context-window budgeting

**Every MCP tool accepts an optional `max_tokens` argument.** Set it and projscan serializes the result, and - if over budget - truncates the largest array field record-by-record until it fits. Responses include a `_budget` sidecar when truncated so your agent knows it got a partial view.

```json
{ "name": "projscan_hotspots", "arguments": { "limit": 100, "max_tokens": 800 } }
```

### Semantic search (0.9.0+, opt-in)

projscan ships with BM25-ranked lexical search by default. To unlock **true semantic search** - embeddings over file content so queries like *"which file implements auth"* hit files that don't literally contain the word "auth" - install the optional peer:

```bash
npm install @xenova/transformers
projscan search "verifying user credentials" --mode semantic
```

Or via the MCP tool:
```json
{ "name": "projscan_search", "arguments": { "query": "verifying user credentials", "mode": "semantic" } }
```

Modes on `projscan_search`:
- `lexical` (default) - BM25 over content + symbol + path boosts. No peer needed.
- `semantic` - cosine similarity on `Xenova/all-MiniLM-L6-v2` embeddings. Requires peer.
- `hybrid` - both, fused via Reciprocal Rank Fusion. Requires peer.

Semantic embeddings are cached at `.projscan-cache/embeddings.bin` keyed by `(model, mtime, content hash)` - invalidates automatically on file change. All offline after the first-run model download (~25MB).

### Pagination, progress, and streaming (0.8.0+)

Large responses can be walked incrementally:

- **Cursor pagination**: pass `cursor` and `page_size`, get `nextCursor` back. Works on `projscan_hotspots`, `projscan_search`, `projscan_audit`, `projscan_outdated`, `projscan_coverage`.
- **Progress notifications**: set `_meta.progressToken` on the tool-call request. The server emits `notifications/progress` at coarse milestones (scanning → analyzing → ranking → done) so your agent can display progress or cancel.
- **Response chunking**: set `stream: true` in arguments to split large arrays into multiple `content` blocks (header + N chunks of ~20 records each).

All opt-in - default behavior is unchanged.

### Incremental index cache

projscan caches parsed ASTs at `.projscan-cache/graph.json` (auto-gitignored). First run populates it; subsequent runs re-parse only files whose `mtime` changed. Agent queries on a warm cache are milliseconds, not seconds.

### Prompts (6, parameterized with live project data)
- `prioritize_refactoring` - ranked plan grounded in current hotspots
- `investigate_file` - senior-engineer brief for a specific file
- **`refactor_hotspot`** *(1.5)* - step-by-step refactor plan for one hotspot file
- **`triage_doctor_issues`** *(1.5)* - critical / important / backlog ordering of open issues
- **`review_this_pr`** *(1.5)* - PR-comment-ready review primed with the structural diff and verdict
- **`safely_rename_symbol`** *(1.5)* - ordered rename + verification checklist via `projscan_impact` blast radius

### Resources (3, readable on demand)
- `projscan://health` · `projscan://hotspots` · `projscan://structure`

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
