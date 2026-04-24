# ProjScan Roadmap

Planned features and improvements. Community suggestions welcome - open an issue or PR.

---

## Big bet: "Agent-First"

The tool is repositioning. The MCP server is the product; the CLI is a consumer of the same primitives.

## Planned

This is the six-month plan coming out of the 0.10 product review. Each version is a themed release with a single headline bet. Order is deliberate: signal quality first (0.11), then the PR-native use case that agents actually need (0.12), then enterprise ceilings (0.13 / 0.14), then a second language proof (0.15).

### 0.11.0 - "Signal Quality"
Replace the LOC proxy in the hotspot score with **AST-derived cyclomatic complexity**. Add **coupling & cycle detection** (per-file fan-in / fan-out from the code graph, circular-dependency flagging). The adapter-per-language work from 0.10 makes both language-agnostic. Low effort, high signal; collects the check on the AST investment.

### 0.12.0 - "PR Native"
Ship a new MCP tool + CLI command that answers **"what changed structurally in this PR?"** Not a text diff - an AST-diff: functions added/removed, export renames, import surface changes, callsite shifts. Positions projscan as the agent's eyes during code review. Strongest under-built agent use case.

### 0.13.0 - "Monorepo"
**Workspace awareness.** Detect pnpm / npm / yarn workspaces, Nx, Turborepo, Lerna. Per-package scoping on every command. Cross-package graph edges (an import from package A's src into package B's published entry). Removes the single-package ceiling; becomes credible at mid-size companies.

### 0.14.0 - "Observability"
**Opt-in, privacy-preserving telemetry.** Tool-call counts, latency histograms, zero source content ever. Stops the guessing - after 0.14 we make data-driven calls instead of intuition-driven ones. Must be easy to turn on and off; off by default; never blocking.

### 0.15.0 - "Second Language"
**Add Go support** via tree-sitter-go (same adapter pattern as Python). Serves two purposes: unlocks the Go backend market, and proves the `LanguageAdapter` interface scales to a second non-JS language. Unblocks Rust / Java as follow-ons.

### Backlog / under consideration

- **Sub-file embeddings** - chunk large files (per-export, per-function, per-class) so semantic search points at specific code blocks. Deferred until 0.14 telemetry shows demand.
- **Registry-aware upgrade preview** - `projscan upgrade <pkg>` optionally fetches `latest` from npm registry; Python equivalent reads pip/poetry metadata.
- **Fix generation via the driving agent** - `projscan fix` today is rule-based; extend with `projscan_fix_suggest` that returns a prompt the agent can act on (agent-native fixes without embedding an LLM in projscan itself).
- **SAST-style security rules** - extend securityCheck with AST-based path-traversal, SQL-injection, XSS rules. Careful - do not turn into a Snyk competitor.
- **Plugin API** - third-party analyzers and reporters. Needs multi-language + monorepo stable first.
- **Multi-repo dashboard / SaaS** - upload baselines, team health trends, org-wide hotspots. Needs telemetry (0.14) first.
- **HTML report export** - standalone HTML health report.
- **Watch mode** - re-scan on file changes.

---

## Recently Shipped

### v0.10.x - "Beyond JS"
- Python is a first-class language. `LanguageAdapter` interface; tree-sitter-python (wasm, offline); Python parser + imports + exports + resolver; package-root detection from pyproject.toml / setup.py / setup.cfg / `__init__.py` walk.
- Four new Python analyzers: `pythonTestCheck`, `pythonLinterCheck`, `pythonDependencyRiskCheck`, `pythonUnusedDependencyCheck`.
- `DEFAULT_IGNORE` extended with Python noise dirs (venv, __pycache__, .tox, .pytest_cache, .mypy_cache, .ruff_cache, .eggs, *.egg-info).
- `deadCodeCheck` widened; `fileInspector` graph-aware; `indexCache` v2; `searchIndex` filters Python keywords.
- +2 runtime deps (web-tree-sitter + tree-sitter-python wasm, ~640 KB vendored). Zero new network activity.

### v0.9.x
- **True Semantic Search (opt-in)** theme
- `@xenova/transformers` as optional peer dep - default install unchanged
- File-level embeddings via `Xenova/all-MiniLM-L6-v2` (384-dim, ~25MB quantized)
- Disk cache keyed by model + mtime + content hash
- Three search modes: `lexical` (default), `semantic`, `hybrid` (RRF)
- Bug fixes: progress-emitter context isolation via AsyncLocalStorage; stderr logging when semantic build aborts

### v0.8.x
- **Streaming & Pagination** theme
- MCP protocol 2025-03-26 (with 2024-11-05 backward negotiation)
- Cursor-based pagination on `projscan_hotspots`, `projscan_search`, `projscan_audit`, `projscan_outdated`, `projscan_coverage`
- Progress notifications on long-running tools (agents that pass a `progressToken` get per-milestone updates)
- Opt-in response chunking via `stream: true` - splits large arrays into multiple MCP content blocks
- Bug fixes: `--changed-only` now reports drop count; hotspot path boundaries extended

### v0.7.x
- **Smart Search** theme. BM25-ranked content + symbols + path.
- `src/core/searchIndex.ts` + `projscan search <query>` + upgraded `projscan_search` MCP tool
- camelCase / snake_case query expansion, light stemming, stopword + TS-keyword filtering
- Bug fixes: MCP budget sidecar on arrays, hotspot ↔ issue linking, dead-code cleanup
- Dogfooded projscan on itself - own doctor score is now A/100

### v0.6.x
- **Agent-First** theme. MCP server becomes the primary product.
- Real AST parsing (`@babel/parser`) replacing regex in the import/export extractor
- `codeGraph` core primitive - bidirectional file×symbol graph
- Incremental `.projscan-cache/` (mtime-keyed) - agent queries become millisecond-fast on warm cache
- MCP context-token budgeter - `max_tokens` arg on any tool, automatic truncation
- New MCP tools: `projscan_graph` (structural queries), `projscan_search` (symbols/files/content)

### v0.5.x
- **Deeper Signal** theme
  - `projscan coverage` - parses lcov / coverage-final / coverage-summary, joins with hotspots, surfaces "scariest untested files"
  - Coverage-weighted hotspot risk - uncovered churning files bubble up
  - Dead-code analyzer - flags source files whose exports nothing imports; respects package.json public entries
  - Import-graph extractor upgraded - captures `import type`, re-exports, and dynamic `import()`

### v0.4.x
- **Dependency Health** theme
  - `projscan outdated` - offline declared-vs-installed drift check
  - `projscan audit` - wraps `npm audit --json`; SARIF-ready; joins findings to `package.json`
  - `projscan upgrade <pkg>` - offline upgrade preview: semver drift, local CHANGELOG breaking-change markers, importer list
  - Unused-dependency analyzer - anchored to exact line in `package.json` for GitHub Code Scanning PR annotations
  - `dep-risk-*` issues gain `package.json` locations

### v0.3.x
- **SARIF output** (`--format sarif`) - feeds GitHub Code Scanning directly; file/line locations on security findings
- **`--changed-only` mode** - scope `analyze` / `doctor` / `ci` to files changed vs a base ref (PR-diff semantics)
- **`.projscanrc` config** - thresholds, rule disables, severity overrides, ignore globs; supports `.projscanrc.json`, `.projscanrc`, or `package.json#projscan`
- **GitHub Action** (`action.yml`) - one-step install → run → upload SARIF to Code Scanning

### v0.2.x
- **Hotspot analysis** (`projscan hotspots`) - git churn × complexity × issue density to rank the files most worth fixing first
- **MCP server** (`projscan mcp`) - exposes projscan as a Model Context Protocol server so AI coding agents (Claude Code, Cursor, Windsurf) can ground their work in project health

### v0.1.x
- Health score and letter grades (A–F)
- Security scanner (secrets, .env files, private keys)
- CI health gate (`projscan ci`)
- Baseline tracking (`projscan diff`)
- Auto-fix system (ESLint, Prettier, Vitest, EditorConfig)
- Architecture diagrams
- File explanation engine
- Health badge generation
