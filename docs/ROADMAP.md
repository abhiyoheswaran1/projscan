# ProjScan Roadmap

Planned features and improvements. Community suggestions welcome — open an issue or PR.

---

## Big bet: "Agent-First"

The tool is repositioning. The MCP server is the product; the CLI is a consumer of the same primitives.

## Planned

### 0.9.0 — True Semantic Search (optional peer)
Real local embeddings via `@xenova/transformers` as an opt-in peer dep — activates only when installed. Local ONNX model, no API calls. Deferred from 0.7 after we validated that BM25 + symbol boosting covers most code-search queries without the ~100MB model footprint.

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

### v0.8.x
- **Streaming & Pagination** theme
- MCP protocol 2025-03-26 (with 2024-11-05 backward negotiation)
- Cursor-based pagination on `projscan_hotspots`, `projscan_search`, `projscan_audit`, `projscan_outdated`, `projscan_coverage`
- Progress notifications on long-running tools (agents that pass a `progressToken` get per-milestone updates)
- Opt-in response chunking via `stream: true` — splits large arrays into multiple MCP content blocks
- Bug fixes: `--changed-only` now reports drop count; hotspot path boundaries extended

### v0.7.x
- **Smart Search** theme. BM25-ranked content + symbols + path.
- `src/core/searchIndex.ts` + `projscan search <query>` + upgraded `projscan_search` MCP tool
- camelCase / snake_case query expansion, light stemming, stopword + TS-keyword filtering
- Bug fixes: MCP budget sidecar on arrays, hotspot ↔ issue linking, dead-code cleanup
- Dogfooded projscan on itself — own doctor score is now A/100

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
