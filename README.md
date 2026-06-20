<div align="center">

# projscan

[![npm version](https://img.shields.io/npm/v/projscan.svg)](https://www.npmjs.com/package/projscan)
[![license](https://img.shields.io/npm/l/projscan.svg)](https://github.com/abhiyoheswaran1/projscan/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/projscan.svg)](https://nodejs.org)
[![projscan health](https://img.shields.io/badge/projscan-A-brightgreen)](#install)

**Local proof for AI-assisted engineering.** projscan gives agents and engineers the repo context, risk checks, proof commands, and review gates they need before editing, handing off, or preparing a release candidate.

[Install](#install) · [Daily workflows](#daily-workflows) · [MCP Setup](#mcp-setup) · [Commands](#command-map) · [Trust](#trust-model) · [Full Guide](docs/GUIDE.md)

<img src="docs/projscan-mission-control.png" alt="projscan Mission Control routing a saved mission into proof status, remaining work, outcome commands, and review gates" width="760">

</div>

---

## Use It For

Use projscan when an agent asks one of these questions:

- Which files should I read before changing this feature?
- Which proof commands should I run before handoff?
- Which risks need fixes, reviewer attention, or release sign-off?

projscan runs core scans on your machine. It respects `.gitignore`, keeps `.env` values out of scans unless you opt in, and exposes the same evidence through a CLI and a 45-tool MCP server. The language layer uses 11 AST adapters covering 12 named languages.

## Install

```bash
npm install -g projscan
projscan start
```

Run without a global install:

```bash
npx projscan start
```

Check the trust boundary first:

```bash
projscan privacy-check
projscan start --intent "what can projscan read?"
projscan start --intent "does projscan read .env values?"
```

## Daily workflows

Use these three workflows before scanning the full command catalog.

### Before editing a feature

```bash
projscan start --intent "what files do I need to change for auth?"
projscan start --intent "what should we build next?" # Routes to a before-edit implementation workplan
projscan understand --view change --intent "add auth token refresh" --format json
projscan preflight --mode before_edit --format json
```

You get a cited change map, read-first files, likely touched files, blocked inputs, and a before-edit proof gate.

Success criteria: the agent can name the files to read first, the likely files to touch, and the proof command to run before editing.

### Before handoff or commit

```bash
projscan bug-hunt --format json
projscan preflight --mode before_commit --format json
projscan evidence-pack --pr-comment
```

You get concrete fixes, manual review gates, owner routing, baseline trend memory, and exact proof commands for the reviewer.

Success criteria: the reviewer sees the top fix, the remaining proof, and any manual sign-off gate without reading the full scan output.

### Before release-candidate review

```bash
projscan release-train --format json
projscan preflight --mode before_merge --format json
projscan evidence-pack --pr-comment
```

You get read-only readiness evidence. projscan reports fixes and sign-off gates; it does not tag, publish, deploy, or bump versions from these commands.

Success criteria: release review separates concrete defects from human approval gates before anyone tags or publishes.

## Mission Control

`projscan start --intent "<goal>"` turns a plain-language goal into an execution plan:

- current command
- blocked inputs
- follow-up commands
- proof queue
- done criteria
- review gate

Save a mission when work may pass between agents:

```bash
projscan start --save-mission .projscan/mission --intent "is it safe to commit this change?"
projscan mission-proof --mission .projscan/mission --format markdown
projscan start --mission .projscan/mission
```

<img src="docs/projscan-proof-router.png" alt="projscan proof workflow showing mission proof, MCP resume input, proof summary, and version review gate" width="760">

Mission bundles include a runbook, task card, handoff prompt, proof scripts, review gate JSON, reviewer replies, and proof logs. `mission-proof` summarizes passed proof, failed gates, reruns, reviewer decisions, and optional manual baseline data.

<details>
<summary><strong>Terminal demos</strong></summary>

<img src="docs/projscan-mission-control.gif" alt="projscan start printing shortcut commands for a safe-commit intent" width="760">

<img src="docs/projscan-mission-proof.gif" alt="projscan saving a mission, reporting proof status, and printing the review gate" width="760">

</details>

Regenerate README media:

```bash
npm run docs:screenshots
npm run docs:demos
```

## 4.9.3 Notes

4.9.3 is a documentation and proof-media patch for the 4.9 trust release:

- README now starts with install, three daily workflows, MCP setup, command map, and the trust model.
- Mission Control screenshots and VHS demos were regenerated from current CLI output.
- The release keeps the 4.9.2 runtime fixes for TypeScript aliases, local package aliases, Next.js App Router entrypoints, explicit before-edit proof, compact reviewer feedback, caution triage, and parallel preflight gathering.

## MCP Setup

Use MCP when an agent should call projscan during a coding session.

Claude Code:

```bash
claude mcp add projscan -- npx -y projscan mcp
```

Codex CLI:

```toml
[mcp_servers.projscan]
command = "npx"
args = ["-y", "projscan", "mcp"]
```

Cursor, Windsurf, Cline, Continue, Zed, and other MCP clients can launch the same command:

```bash
npx -y projscan mcp
```

Add `--watch` if the client supports `notifications/file_changed`:

```bash
npx -y projscan mcp --watch
```

### Agent Questions

| Agent question                               | CLI or MCP route                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| Which files implement auth?                  | `projscan search "auth" --format json`                                           |
| Who imports this file?                       | `projscan semantic-graph --query importers --file src/auth/jwt.ts --format json` |
| What breaks if I rename this symbol?         | `projscan impact --symbol buildCodeGraph --format json`                          |
| What should I fix first?                     | `projscan bug-hunt --format json`                                                |
| Which files have high risk and low coverage? | `projscan coverage --format json`                                                |
| What should my agent do next?                | `projscan workplan --format json`                                                |
| Which proof belongs in this PR?              | `projscan evidence-pack --pr-comment`                                            |
| Is this branch ready to merge?               | `projscan preflight --mode before_merge --format json`                           |

## Command Map

| Command                   | Use it when you need                                                       |
| ------------------------- | -------------------------------------------------------------------------- |
| `projscan start`          | first-60-seconds orientation, routing, and Mission Control                 |
| `projscan understand`     | cited repo map, runtime flows, public contracts, and change readiness      |
| `projscan preflight`      | proceed, caution, or block gate for edit, commit, or merge                 |
| `projscan evidence-pack`  | PR-ready proof with risks, owners, and next commands                       |
| `projscan bug-hunt`       | ranked fix queue from health, hotspots, session, and preflight evidence    |
| `projscan workplan`       | ordered agent tasks with proof and handoff text                            |
| `projscan doctor`         | project health, tooling gaps, dead code, and supply-chain signals          |
| `projscan review`         | one-call PR review from structural diff, risk, cycles, functions, and deps |
| `projscan impact`         | blast radius for a file or symbol before rename, delete, or upgrade        |
| `projscan semantic-graph` | imports, exports, importers, symbol definitions, and package importers     |
| `projscan dataflow`       | framework-aware source-to-sink risks                                       |
| `projscan hotspots`       | churn, complexity, ownership, and coverage risk ranking                    |
| `projscan coverage`       | high-risk files with weak test coverage                                    |
| `projscan dependencies`   | dependency inventory, license summary, and risk notes                      |
| `projscan upgrade <pkg>`  | offline upgrade impact from changelog and importer evidence                |
| `projscan audit`          | normalized `npm audit` findings and SARIF                                  |
| `projscan coordinate`     | collisions, claims, and merge-risk across worktrees                        |
| `projscan plugin`         | local analyzer and reporter plugin workflow                                |
| `projscan privacy-check`  | local scan boundary, telemetry, ignore rules, and network-capable paths    |
| `projscan mcp`            | MCP server over stdio                                                      |

Run the generated command help when you need flags:

```bash
projscan help
projscan <command> --help
```

## Output Formats

Commands support `console`, `json`, `markdown`, `sarif`, and `html` where those formats fit the command.

```bash
projscan analyze --format json
projscan doctor --format markdown
projscan ci --format sarif > projscan.sarif
projscan evidence-pack --pr-comment
projscan mission-proof --write reports/mission-proof.md
```

Use scoped and redacted reports when evidence leaves the repo:

```bash
projscan analyze --report-scope src/api --redact-paths --format json
projscan analyze --report-scope "src/api,packages/backend" --redact-paths --format json
projscan doctor --report-policy apiEvidence --format markdown
```

## Configuration

Create a `.projscanrc.json` when repo defaults should live in source control:

```json
{
  "minScore": 80,
  "baseRef": "origin/main",
  "ignore": ["**/fixtures/**", "**/generated/**"],
  "scan": {
    "includeIgnored": false,
    "scanEnvValues": false,
    "offline": false
  },
  "disableRules": ["large-*"],
  "severityOverrides": {
    "missing-prettier": "info"
  },
  "reportPolicies": {
    "apiEvidence": {
      "reportScope": ["src/api", "packages/backend"],
      "redactPaths": true
    }
  }
}
```

Config docs live in [docs/GUIDE.md](docs/GUIDE.md#configuration-projscanrc).

## CI

Use `projscan ci` to gate pull requests:

```bash
projscan ci --min-score 80
projscan ci --changed-only
projscan ci --format sarif > projscan.sarif
```

GitHub Actions example:

```yaml
name: ProjScan
on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  security-events: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - uses: abhiyoheswaran1/projscan@v1
        with:
          min-score: '80'
          changed-only: 'true'
```

## Plugins

Local plugins let teams add project-specific analyzer rules and custom human reports without changing projscan core.

### Load local plugins

```bash
projscan plugin list
projscan plugin validate .projscan-plugins/team-radar.projscan-plugin.json
projscan plugin test .projscan-plugins/team-radar.projscan-plugin.json
PROJSCAN_PLUGINS_PREVIEW=1 projscan doctor --reporter team-radar
```

Run `projscan help` for the generated command-by-command support matrix.

<img src="docs/projscan-reporter-plugin.png" alt="projscan reporter plugin rendering a team health report" width="760">

Plugin docs:

- [Plugin Authoring](docs/PLUGIN-AUTHORING.md)
- [Plugin Gallery](docs/PLUGIN-GALLERY.md)
- [2.0 Migration Guide](docs/2.0-MIGRATION.md)
- [Manifest Schema](docs/plugin.schema.json)

## Supported Repos

projscan reads TypeScript, JavaScript, Python, Go, Java, Ruby, Rust, PHP, C#, Kotlin, Swift, C, and C++ with AST-aware adapters where available. It also detects file-level signals for Shell, CSS, HTML, SQL, Dart, Lua, Scala, R, and related project files.

Framework signals cover React, Next.js, Vue, Nuxt, Svelte, Angular, Express, Fastify, NestJS, Vite, Tailwind CSS, Prisma, Remix, SvelteKit, Astro, Hono, Koa, and common monorepo layouts.

JavaScript and TypeScript use `@babel/parser`. Non-JS languages use packaged tree-sitter WASM grammars. The published package has 7 direct runtime dependencies; optional semantic search uses the peer dependency `@xenova/transformers`.

## Trust Model

| Area         | projscan behavior                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Source code  | Core scans read local files and keep results on your machine.                                                                                  |
| `.gitignore` | Ignored files stay out of scans unless you pass `--include-ignored`.                                                                           |
| `.env`       | projscan reports paths by default. It reads values after `--scan-env-values`.                                                                  |
| Network      | `audit`, registry checks, opt-in telemetry, and optional semantic model download can contact the network.                                      |
| Telemetry    | Off until you run `projscan telemetry enable` or accept the `init team` prompt.                                                                |
| Plugins      | Local plugin code runs after `PROJSCAN_PLUGINS_PREVIEW=1` and an execution path such as `doctor`, `ci`, `analyze`, or `plugin test --execute`. |
| Repo writes  | Source writes require explicit fix commands. Cache and mission proof files stay under local projscan directories.                              |

Audit helpers:

```bash
projscan privacy-check
projscan telemetry status
projscan telemetry explain
projscan doctor --offline
```

Supply-chain scanners may flag package strings or APIs used by `git`, `npm audit`, `web-tree-sitter`, optional plugins, and optional semantic search. The runtime paths above describe when those capabilities run.

## Install Notes

`projscan@4.9.3` has seven direct runtime dependencies:

- `@babel/parser`
- `@babel/types`
- `chalk`
- `commander`
- `fast-glob`
- `ora`
- `web-tree-sitter`

If npm prints `allow-scripts` warnings during a global install, check which package names it lists. projscan core does not need `node-gyp` grammar builds at runtime in 4.9.3. Open an issue with the warning text if npm reports install scripts from `projscan@latest`.

The grammar packages are build-time sources, not global-install dependencies. Published grammar assets include `tree-sitter-python.wasm` and `tree-sitter-c_sharp.wasm`.

## Deeper Docs

- [Full guide](docs/GUIDE.md)
- [First 10 minutes](docs/FIRST-10-MINUTES.md)
- [Roadmap](docs/ROADMAP.md)
- [Adoption workflows](docs/examples/adoption-workflows.md)
- [Swarm coordination](docs/examples/swarm-coordination.md)
- [Stability policy](docs/STABILITY.md)
- [Telemetry policy](TELEMETRY.md)
- [Security policy](SECURITY.md)

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR. Contributions use the MIT License and the DCO 1.1 certification described there.

## Legal

- License: [MIT](LICENSE)
- Disclaimer: [DISCLAIMER.md](DISCLAIMER.md)
- Security policy: [SECURITY.md](SECURITY.md)
- Privacy notice: [PRIVACY.md](PRIVACY.md)
- Telemetry policy: [TELEMETRY.md](TELEMETRY.md)
- Trademark and brand policy: [TRADEMARKS.md](TRADEMARKS.md)
- Third-party notices: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)

<p align="center">
  <a href="https://www.baseframelabs.com" target="_blank" rel="noopener" title="Part of Baseframe Labs">
    <span>part of</span>
    <img src="public/brand/baseframe-labs/wordmark-light.svg" alt="Baseframe Labs" height="18" style="vertical-align: middle; opacity: 0.9;">
  </a>
</p>
