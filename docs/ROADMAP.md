# ProjScan Roadmap

Planned features and improvements. Community suggestions welcome — open an issue or PR.

---

## Big bet: "Agent-First"

The tool is repositioning. The MCP server is the product; the CLI is a consumer of the same primitives.

## Planned

### 0.7.0 — Semantic Search
Local embeddings over file chunks; nearest-neighbor queries. Agents ask *"which files implement auth?"* and get semantically relevant results, not regex hits. No API calls — offline-first.

### 0.8.0 — Streaming MCP
Stream large responses so agents can stop reading as soon as they have enough. Especially for `projscan_graph` on large repos.

### Real Cyclomatic Complexity
Now that AST is in place (0.6), add cyclomatic complexity per function. Replace the LOC proxy in the hotspot score.

### Coupling & Cycle Detection
Per-file fan-in / fan-out from the code graph, circular-dependency detection.

### Registry-aware Upgrade Preview
Today's `projscan upgrade` is offline. Optionally fetch `latest` from the npm registry and diff against what's installed.

---

## Under Consideration

- **Monorepo support** — scan multiple packages in a single workspace
- **HTML report export** — generate a standalone HTML health report
- **Watch mode** — re-scan on file changes
- **Plugin API** — third-party analyzers and reporters
- **Real cyclomatic complexity** — AST-based, replacing the LOC proxy

---

## Recently Shipped

### v0.6.x
- **Agent-First** theme. MCP server becomes the primary product.
- Real AST parsing (`@babel/parser`) replacing regex in the import/export extractor
- `codeGraph` core primitive — bidirectional file×symbol graph
- Incremental `.projscan-cache/` (mtime-keyed) — agent queries become millisecond-fast on warm cache
- MCP context-token budgeter — `max_tokens` arg on any tool, automatic truncation
- New MCP tools: `projscan_graph` (structural queries), `projscan_search` (symbols/files/content)

### v0.5.x
- **Deeper Signal** theme
  - `projscan coverage` — parses lcov / coverage-final / coverage-summary, joins with hotspots, surfaces "scariest untested files"
  - Coverage-weighted hotspot risk — uncovered churning files bubble up
  - Dead-code analyzer — flags source files whose exports nothing imports; respects package.json public entries
  - Import-graph extractor upgraded — captures `import type`, re-exports, and dynamic `import()`

### v0.4.x
- **Dependency Health** theme
  - `projscan outdated` — offline declared-vs-installed drift check
  - `projscan audit` — wraps `npm audit --json`; SARIF-ready; joins findings to `package.json`
  - `projscan upgrade <pkg>` — offline upgrade preview: semver drift, local CHANGELOG breaking-change markers, importer list
  - Unused-dependency analyzer — anchored to exact line in `package.json` for GitHub Code Scanning PR annotations
  - `dep-risk-*` issues gain `package.json` locations

### v0.3.x
- **SARIF output** (`--format sarif`) — feeds GitHub Code Scanning directly; file/line locations on security findings
- **`--changed-only` mode** — scope `analyze` / `doctor` / `ci` to files changed vs a base ref (PR-diff semantics)
- **`.projscanrc` config** — thresholds, rule disables, severity overrides, ignore globs; supports `.projscanrc.json`, `.projscanrc`, or `package.json#projscan`
- **GitHub Action** (`action.yml`) — one-step install → run → upload SARIF to Code Scanning

### v0.2.x
- **Hotspot analysis** (`projscan hotspots`) — git churn × complexity × issue density to rank the files most worth fixing first
- **MCP server** (`projscan mcp`) — exposes projscan as a Model Context Protocol server so AI coding agents (Claude Code, Cursor, Windsurf) can ground their work in project health

### v0.1.x
- Health score and letter grades (A–F)
- Security scanner (secrets, .env files, private keys)
- CI health gate (`projscan ci`)
- Baseline tracking (`projscan diff`)
- Auto-fix system (ESLint, Prettier, Vitest, EditorConfig)
- Architecture diagrams
- File explanation engine
- Health badge generation
