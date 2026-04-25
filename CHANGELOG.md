# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.11.0] - 2026-04-25

### Theme - "Six-month bundle"

0.11.0 ships the entire 0.11 → 0.15 themed roadmap as one release. Five themes, one version: Signal Quality, PR Native, Monorepo, Observability, Second Language. The original per-version sequence is in [docs/ROADMAP.md] for context, but it has been consumed by this release. The deferred backlog there is still authoritative for "what's next."

### Added — Signal Quality (was 0.11)

- **AST-derived cyclomatic complexity** is now part of the `LanguageAdapter.parse()` output for JS/TS (Babel decision-point counter) and Python (tree-sitter walk). Per-file CC is persisted in the code graph and the index cache. Counted decision points: `if`, `else if`/`elif`, `for`/`for-in`/`for-of`/`for_in_clause`, `while`/`do-while`, `case` (default does not count), `catch`/`except`, `?:`, `&&`/`||`/`??`, `and`/`or`, comprehension `if`. Optional chaining and `else` do not count.
- **Replaces LOC in the hotspot risk score.** `complexityWeight` and `hotChurnXComplexity` terms now read CC. Files outside the language-adapter set (`.rb`, `.go` files in non-Go projects, `.java`, etc.) keep the LOC fallback so behaviour degrades gracefully.
- **`projscan_coupling` MCP tool + `projscan coupling` CLI** - per-file fan-in / fan-out / instability (Bob Martin's I = Ce / (Ca + Ce)) and circular-import cycles (iterative Tarjan SCC, size ≥ 2). Filters: `--cycles-only`, `--high-fan-in`, `--high-fan-out`, `--file <path>`.
- **`projscan_file` enriched** with `cyclomaticComplexity`, `fanIn`, `fanOut` fields. Markdown reporter shows a CC column on the hotspots table.

### Added — PR Native (was 0.12)

- **`projscan_pr_diff` MCP tool + `projscan pr-diff` CLI** - structural diff between two refs. Spins up a temporary git worktree at the base ref, builds a CodeGraph there, diffs against the head graph. Per file: added / removed / modified plus explicit lists of exports added/removed, imports added/removed, call sites added/removed, ΔCC, Δfan-in. Default base resolution: `origin/main` → `main` → `origin/master` → `master` → `HEAD~1`.
- `diffGraphs()` exported as a pure function so callers can run the diff on graphs they already have without the worktree round-trip.

### Added — Monorepo (was 0.13)

- **`detectWorkspaces()`** handles npm/yarn workspaces (`package.json#workspaces`), pnpm (`pnpm-workspace.yaml`, parsed with a tiny YAML subset reader to avoid pulling in a full YAML dep), and an Nx/Turbo/Lerna fallback (`packages/*` + `apps/*` + `libs/*`).
- **`projscan_workspaces` MCP tool + `projscan workspaces` CLI** list every package (name, relative path, version, root flag).
- **`--package <name>` flag on `projscan hotspots` and `projscan coupling`** (CLI and MCP `package` arg) scopes results to a single workspace via longest-prefix matching. `findPackageForFile()` correctly handles the `packages/a` vs `packages/ab` ambiguity.

### Added — Observability (was 0.14)

- **Opt-in privacy-preserving telemetry.** Off by default. Enable via `.projscanrc` `telemetry: { enabled: true, sink?: "..." }` block, or `PROJSCAN_TELEMETRY=1` env. `PROJSCAN_TELEMETRY=0` is a per-machine kill switch even when rc opts in.
- Records exactly: tool name, duration ms, success, projscan version, ISO timestamp. Optional `errorCode` on failure. Never records: source content, file paths, arguments, repo identifiers, machine identifiers.
- Sink: local JSONL file (default `~/.projscan/telemetry.jsonl`). No remote endpoint in this release.
- Wired into the MCP `tools/call` dispatch as fire-and-forget; sink failures are swallowed so telemetry can never break a tool call.
- **`projscan_telemetry` MCP tool** surfaces effective config so agents can introspect state without reading config files.

### Added — Second Language (was 0.15)

- **Go via tree-sitter-go 0.25.0** (ships WASM in the npm tarball, ~210 KB). `goAdapter` mirrors the Python adapter shape.
- `goImports.ts` handles single-line and parenthesized import blocks, including aliased forms (`util "github.com/foo/util"`).
- `goExports.ts` applies Go's mechanical export rule (leading uppercase Unicode letter), distinguishing struct/interface/type and capturing func, method, var, const at top level.
- `goCyclomatic.ts` counts decision points: `if`, `for`, `expression_case`, `type_case`, `communication_case`, and `binary_expression` with `&&` / `||`. Default cases and `defer`/`go` statements do not count.
- `goManifests.ts` reads `go.mod` for the module path. Imports prefixed with the module path resolve into the repo; everything else (stdlib, third-party) is treated as external. Local dot-imports also supported.
- Find-package logic resolves a Go import to any `.go` file in the target directory (Go packages are directory-scoped).

### Changed

- **`indexCache` bumped to v3.** Cache entries now carry `cyclomaticComplexity`. v2 caches are discarded on first 0.11 run and rebuilt automatically — no user action required.
- **`projscan_hotspots`** description updated to mention "AST cyclomatic complexity" instead of generic "complexity." Hotspot reasons line says "high complexity (CC X)" / "moderate complexity (CC X)" instead of "large file (X lines)" when AST data is available.
- **`projscan_file`** returns `cyclomaticComplexity`, `fanIn`, `fanOut` fields. Existing fields unchanged.
- **MCP tool count: 13 → 17** (new: `projscan_coupling`, `projscan_pr_diff`, `projscan_workspaces`, `projscan_telemetry`).

### Score-magnitude shift

CC is much smaller than LOC for the same file (a 200-line file might have CC of 10–20 vs LOC of 200). Absolute hotspot scores will drop for adapter-parsed files (JS/TS, Python, Go), even though *rankings* improve. If your CI uses a hard threshold against `riskScore`, recalibrate it after the first 0.11 run.

### Runtime dependencies

Added `tree-sitter-go@^0.25.0` (~210 KB vendored wasm). Total runtime deps: 9 (was 8). Total vendored wasm: ~850 KB.

### Gap-fill pass (closes the bundling shortcuts that landed in earlier 0.11 commits)

A self-audit caught five gaps versus the original 0.11→0.15 roadmap text. All closed before release:

- **Export rename detection in `projscan_pr_diff`.** `FileAstDiff` now carries an `exportsRenamed: [{from, to}]` list. A removed/added pair is reclassified as a rename when their similarity (max of normalized Levenshtein and shared-affix fraction) exceeds 0.5. Greedy best-score-first pairing; each name participates in at most one pair. Anything below threshold stays in the +/- lists. Reporters surface renames as `~exports: foo → fooBar`.
- **Real Nx + Lerna config parsing.** `lerna.json#packages` is read directly. `nx.json#workspaceLayout` (custom appsDir/libsDir) is honoured, then `project.json` files are scanned in the layout dirs (modern Nx) and `workspace.json#projects` is read for legacy Nx. `turbo.json` stays as a marker (turbo doesn't declare workspaces — it always rides on top of npm/yarn/pnpm).
- **`--package` scope on more commands.** Previously only on `hotspots` and `coupling`; now also on `analyze`, `doctor`, `structure`, `coverage`, `search`, and `pr-diff` (CLI flag and MCP `package` arg). `dependencies`/`outdated`/`audit` stay project-level — they read root manifests and per-package scoping would require workspace-aware lockfile parsing (deferred).
- **Cross-package graph edges.** `CouplingReport` now carries `crossPackageEdges: [{from: {file, package}, to: {file, package}}]`, computed when workspace info is available and at least two non-root packages exist. Surfaces in `projscan_coupling` MCP output and console / markdown coupling reports. Useful for spotting unauthorized deep imports across package boundaries.
- **Telemetry histograms.** New `aggregateTelemetry()` reads the JSONL sink and returns per-tool `{count, errorCount, errorRate, p50Ms, p95Ms, p99Ms, meanMs, minMs, maxMs}`. Exposed via `projscan_telemetry { aggregate: true }` MCP tool and `projscan telemetry --aggregate` CLI command. Linear-interpolation percentiles; malformed JSONL lines are skipped silently.

### Notes

- **659 tests passing** (+61 over 0.10). New coverage: AST CC for JS/TS + Python, Python CC node types (incl. comprehensions and match/case), coupling fan-in/out/instability + Tarjan SCC (DAG, 2-cycle, 3-cycle, disjoint, self-loop ignored) + cross-package-edge detection, hotspot LOC→CC switch + LOC fallback regression, monorepo detection (npm/yarn/pnpm/Nx project.json/Nx workspace.json/Lerna packages/Turbo fallback), prefix-matching against `packages/a` vs `packages/ab`, telemetry config + env override + JSONL append + sink-failure silence + aggregation (percentiles + ordering + malformed-line skip), Go parser/imports/exports/CC + end-to-end fixture (example.com/widget module with main + internal/util), export rename detector (similar pairs vs unrelated), pack-smoke test extended for tree-sitter-go.wasm.
- All previous behaviour preserved for non-AST languages; existing JS/TS and Python paths only see the LOC→CC swap in hotspot scoring.
- Bundling-tradeoff acknowledged: this release loses the 0.14 telemetry → 0.15 language-pick feedback loop the original roadmap envisioned. Future "what next?" decisions will have to lean on issues / PR feedback rather than telemetry until enough 0.11 users opt in.

## [0.10.0] - 2026-04-24

### Theme - "Beyond JS"

Python is now a first-class language. The import graph, code search, hotspot analysis, dead-code detection, and MCP tools all work on Python repos. JavaScript and TypeScript behavior is unchanged. This is the first step toward a multi-language projscan; Go and Rust are planned for 0.11+.

### Added

- **`LanguageAdapter` interface** (`src/core/languages/LanguageAdapter.ts`) - abstraction that lets every core primitive (parse, resolve imports, detect packages) be implemented per-language. The existing babel-based code is wrapped as the `javascript` adapter; the new tree-sitter-based Python implementation is the `python` adapter. Registration is extension-keyed via `src/core/languages/registry.ts`. Third parties can add new languages by implementing the interface and calling `registerAdapter`.
- **Python parser via tree-sitter** - `web-tree-sitter` 0.26.8 runtime (wasm, pure Node; no native compile) plus a pinned `tree-sitter-python` 0.25.0 grammar. Both wasm artifacts are vendored into `dist/grammars/` at build time via `scripts/copy-wasm.mjs`, so there is zero network activity at runtime (still offline-first). First use of a `.py` file lazy-loads the grammar.
- **Python imports / exports / resolver** - captures `import`, `from ... import`, relative imports (`from . import`, `from ..mod import`), aliased imports, `from x import *`, and conditional imports inside `try/except ImportError` blocks. `__future__` imports are filtered. Exports cover top-level `def` / `async def` / `class`, assignments to identifiers and tuple patterns, re-exports from `from .mod import x`, decorated functions/classes, and honors `__all__` as an authoritative allowlist when declared as a literal list/tuple. Underscore-prefixed names are private unless listed in `__all__`.
- **Python package-root detection** - reads `pyproject.toml` (PEP 621, Poetry, setuptools `packages.find` / `package-dir`), `setup.py` `install_requires`, `setup.cfg` `[options] install_requires`, `requirements*.txt`. Falls back to walking `__init__.py` placement, then the repo root. Resolver handles absolute imports against detected roots and relative imports with dot-walks; probes module-as-`.py` then module-as-`/__init__.py`.
- **Four new Python analyzers**, wired into the issue engine:
  - `pythonTestCheck` - detects pytest / unittest / nose / ward via manifests, `pytest.ini`, `tox.ini`, `[tool.pytest.ini_options]`, or `import unittest` in test files. Emits `missing-python-test-framework` (warning) or `no-python-test-files` (info).
  - `pythonLinterCheck` - detects ruff / flake8 / pylint and black / ruff-format / autopep8 / yapf via config files and manifests. Emits `missing-python-linter` and/or `missing-python-formatter` (warning).
  - `pythonDependencyRiskCheck` - flags deprecated packages (nose, simplejson, pycrypto, mysql-python), soft-deprecated (python-dateutil), heavy (pandas, numpy, torch, tensorflow), unpinned requirements.txt entries, and missing lockfiles. Anchored to `pyproject.toml` / `requirements.txt` lines for GitHub Code Scanning PR annotations.
  - `pythonUnusedDependencyCheck` - diffs declared Python deps against packages actually imported. Implicit-use allowlist covers pytest, ruff, black, mypy, coverage, wheel, build, setuptools, pip, pip-tools, twine, flake8, pylint, isort, bandit, tox, pre-commit, hatch, maturin, and related tooling. PEP 503 name normalization (case-insensitive, `_` / `-` / `.` equivalence).
- **`DEFAULT_IGNORE` extended for Python noise** - `venv/`, `.venv/`, `env/`, `.env/`, `__pycache__/`, `.tox/`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `.eggs/`, `*.egg-info/`. Without this, a repo with a committed virtualenv would scan thousands of third-party files and destroy the health score.
- **`FileInspection.language`** - new optional field exposing which adapter parsed the file.
- **MCP `projscan_upgrade` Python fallback** - returns `available:false` with a clear "unsupported for Python" reason on Python-dominated repos rather than hitting the node_modules CHANGELOG pipeline.
- **Public API:** `LanguageAdapter`, `LanguageResolveContext`, `getAdapterFor`, `isAdapterParseable`, `listAdapters`, `registerAdapter`, `pythonAdapter`, `javascriptAdapter`, `detectPythonProject`, `parsePyproject`, `parseRequirements`, `splitPep508`.

### Changed

- **`deadCodeCheck` rewritten to use `buildCodeGraph` directly** - language-agnostic. `__init__.py` is treated as a barrel equivalent (like `index.ts`); pytest test-file conventions (`test_*.py`, `*_test.py`, and files under `tests/`) are skipped. Message uses "names" for Python vs "exports" for JS/TS.
- **`fileInspector` prefers graph-derived imports/exports** when a `CodeGraph` is supplied. Running the JS-only regex against Python source would emit garbage; now Python files without a graph return empty imports/exports instead.
- **`codeGraph` resolution order flipped to local-first** - previously JS-optimized (relative = local, bare = package). Python's `pkg.core` could be either. Now every adapter's `resolveImport` gets a shot at local resolution before the specifier is classified as a third-party package.
- **`indexCache` bumped to v2** - entries carry `adapterId`, so a file switching adapters (unlikely in practice) invalidates cleanly.
- **`searchIndex` keyword filter** now includes Python keywords (`def`, `class`, `self`, `lambda`, `yield`, `pass`, `elif`, etc.) so they don't pollute BM25 scoring.
- **README, ROADMAP, GUIDE, CONTRIBUTING** updated to reflect multi-language support. ROADMAP moves sub-file embeddings from "Planned 0.10" down to Under Consideration / 0.11+.

### Runtime dependencies

Added `web-tree-sitter` (~200 KB wasm runtime) and `tree-sitter-python` (~450 KB grammar). Total footprint is ~640 KB of vendored wasm. Runtime deps go from 4 to 6. No network at runtime; wasm ships in the published tarball.

### Notes

- **~600 tests passing** (+90 over 0.9.2). New coverage: adapter registry, Python parser/imports/exports/resolver/package-roots, manifest parsing, 4 new analyzers, mixed-language graph sanity, Python integration test, pack-smoke test for vendored wasm.
- All JS/TS tests unchanged; zero behavior change for JS/TS projects.
- No Python interpreter required anywhere. Tests, CI, and runtime all stay pure Node.

## [0.9.2] - 2026-04-20

### Security

Fixes a **path traversal / arbitrary file read** in the `projscan_upgrade` MCP tool (CVE assignment pending).

Severity: **HIGH**. Users who expose `projscan mcp` to an AI agent that processes untrusted content should upgrade.

**What was wrong.** The `package` argument to `projscan_upgrade` was forwarded to `previewUpgrade` without validation. The implementation called `path.join(rootPath, 'node_modules', name, ...)` which normalizes `..` segments. A name like `../../../other-project` escaped `node_modules/` and caused the tool to return the contents of an arbitrary `CHANGELOG.md` / `CHANGELOG` / `History.md` / `HISTORY.md` file plus the `version` from any `package.json` in the traversed directory.

**Exploit model.** An AI agent using projscan over MCP processes untrusted content (README, issue body, web page, etc.). That content contains a prompt-injection payload instructing the agent to call `projscan_upgrade` with an attacker-chosen `package` argument. Without the fix, the returned `changelogExcerpt` exfiltrates files outside the project root.

**Fix (defense in depth).**

1. `isValidPackageName(name)` rejects anything not matching the npm package-name grammar: `^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$`. This rejects `..`, `/` (except the single scope separator), `\`, whitespace, null bytes, absolute paths, and overlong names.
2. Even if a future regression let a bad name through the first check, `readInstalledVersion` and `readChangelog` now resolve the target against `node_modules/` and refuse any path that escapes it (the same containment pattern already used in `projscan_explain` / `inspectFile`).
3. 5 new regression tests cover the traversal-rejection path with realistic attacker payloads.

**Scope.** Only `previewUpgrade` (and the `projscan_upgrade` MCP tool / CLI `projscan upgrade <pkg>`) was affected. Other MCP tools (`projscan_file`, `projscan_explain`) already enforced root containment.

**Public API.** `isValidPackageName` is exported for downstream users who want the same check.

No behavior change for any well-formed package name. 276 tests passing (+5 new).

## [0.9.1] - 2026-04-20

### Changed

Docs polish. No behavior changes, no API changes.

- Removed em dashes from all public-facing documentation (README, CHANGELOG, CONTRIBUTING, ROADMAP, GUIDE), the `package.json` description, the CLI banner/help output, and MCP prompt text. Replaced with hyphens, colons, or periods depending on context. Em dashes are a common "tell" that text was AI-generated, and we care about the tool reading like it was written by a person.
- Also cleaned up JSDoc comments in source since those surface in IDE tooltips.

No runtime changes. 271 tests still passing.

## [0.9.0] - 2026-04-20

### Theme - "True Semantic Search (opt-in)"

Real embeddings-based search via `@xenova/transformers` as an **optional peer dependency**. projscan's default install remains small; users who want semantic search opt in by installing the peer (~50MB + ~25MB first-run model download).

### Added

- **Optional peer dep** `@xenova/transformers` declared with `peerDependenciesMeta.optional: true`. Not pulled unless the user explicitly installs it. Default installs get a npm warning but no actual download - exactly as intended.
- **`src/core/embeddings.ts`** - dynamic-import wrapper around the peer. `isSemanticAvailable()`, `embedText()`, `embedBatch()`, `cosineSimilarity()`. Model: `Xenova/all-MiniLM-L6-v2` (384-dim, quantized, ~25MB). Graceful `ERR_MODULE_NOT_FOUND` handling.
- **`src/core/semanticSearch.ts`** - file-level embeddings, cosine similarity retrieval, disk cache at `.projscan-cache/embeddings.bin` (keyed by model + mtime + content hash, invalidates on any change). Incremental builds reuse cached vectors.
- **Upgraded `projscan_search` MCP tool** - new `mode` argument:
  - `lexical` (default) - BM25 only, no peer needed. Unchanged from 0.7.
  - `semantic` - embeddings only. Requires peer. Returns helpful error if missing.
  - `hybrid` - BM25 + semantic via Reciprocal Rank Fusion (RRF). Files ranked near the top of *both* lists win.
- **Upgraded CLI `projscan search`** - `--mode semantic|lexical|hybrid` and `--semantic` shortcut.
- **Public API:** `isSemanticAvailable`, `embedText`, `embedBatch`, `cosineSimilarity`, `DEFAULT_MODEL`, `EMBEDDING_DIM`, `buildSemanticIndex`, `semanticSearch`, `reciprocalRankFusion`.

### Fixed (bug-hunt round 3)

- **Progress emitter context could leak between concurrent tool calls.** The previous implementation stored the current emitter on a module-level variable - when two tool calls overlapped (common under MCP pipelining), call A's progress events would route to call B's client mid-flight, and vice versa. Rewrote using Node's `AsyncLocalStorage` so every `withProgress` call gets an isolated context. A regression test covers the interleaved case.
- **Semantic index build aborted silently if the peer dep disappeared mid-batch.** Now writes a stderr diagnostic so operators can tell the capability was disabled, not that it returned zero results.

### Notes on the peer-dep model

If you just want the CLI, do nothing - `projscan` still works end to end. Your install stays ~7MB.

If you want semantic search:
```bash
npm install @xenova/transformers
projscan search "which file implements auth" --mode semantic
```

The first run downloads the model (~25MB). Subsequent runs hit the local HuggingFace cache. All queries stay offline after that - no API calls, ever.

### Stats

- 271 tests passing (+11 new, including the concurrency regression)
- 2 new runtime-optional packages (only if opted in): `@xenova/transformers`, `@babel/parser` + `@babel/types` stay the same
- All semantic search is offline after first-run model download

## [0.8.0] - 2026-04-20

### Theme - "Streaming & Pagination"

MCP agents can now consume large responses incrementally: cursor-based pagination, progress notifications during long-running tools, and opt-in response chunking. Protocol bumped to 2025-03-26 with backward negotiation for 2024-11-05 clients.

### Added

- **MCP protocol 2025-03-26** with version negotiation. Clients requesting 2024-11-05 still work - the server echoes their version when supported.
- **Cursor-based pagination** on list-returning MCP tools: `projscan_hotspots`, `projscan_search`, `projscan_audit`, `projscan_outdated`, `projscan_coverage`. Accept `cursor` + `page_size`; return `nextCursor` when more results exist. Cursor is opaque base64; includes a checksum so shape-changes across calls reset to offset=0 safely.
- **Progress notifications** (`notifications/progress`) during long-running tools: `projscan_analyze` (5 milestones), `projscan_hotspots` (4 milestones), `projscan_audit` (2 milestones). Agents that set `_meta.progressToken` on the request get per-milestone updates they can display or use to cancel.
- **Opt-in response chunking** - when the caller sets `stream: true`, tool output is split into multiple MCP `content` blocks: one header with scalar fields, then N chunk blocks containing 20 records each. Default behavior (single block) unchanged for backward compatibility.
- **New public API:** `paginate`, `encodeCursor`, `decodeCursor`, `listChecksum`, `readPageParams`, `toContentBlocks`, `emitProgress`, `withProgress`.
- **`createMcpServer` gains an options object** with `notify: (payload) => void` for transports that want to emit out-of-band JSON-RPC notifications. `runMcpServer` wires this to stdout automatically.

### Fixed

- **`--changed-only` silently dropped issues without file locations.** Now emits a stderr message: `"N issue(s) filtered out; X had no file location"` so users can tell the difference between "no problems in this PR" and "filter dropped everything."
- **Hotspot substring fallback had incomplete path-boundary chars.** Added `.`, `?`, `!`, `>`, `<` so cases like *"see src/a.ts."* (sentence end) correctly link to `src/a.ts`. The location-based path still takes priority when analyzers supply it.

### Notes

- 260 tests passing (+11 new covering pagination, progress, chunking).
- Zero new runtime dependencies.
- Clients on old protocol version: no action required - negotiation is transparent.

## [0.7.0] - 2026-04-20

### Theme - "Smart Search"

Ranked local search across content, symbols, and paths. No embeddings, no API calls, no 100MB model downloads - just a solid BM25 implementation that beats substring matching for most code-search queries.

**Why not embeddings in 0.7?** The only credible local-embeddings path in Node.js (`@xenova/transformers`) pulls a ~100MB ONNX model. For code search - where queries and identifiers share vocabulary (`auth`, `jwt`, `token`, `session`) - BM25 + symbol weighting captures most of the semantic value at 0% of the install-size cost. True semantic search is deferred; the door is explicitly left open as a future opt-in peer dep.

### Added

- **`src/core/searchIndex.ts`** - BM25-ranked inverted index over source files. Indexes content, exported symbol names, and path tokens separately, each with its own weight.
- **Query expansion** - camelCase / snake_case / digit splitting, light stemming (strip trailing `-s` / `-ing` / `-ed`), stopword + TS-keyword filtering. `userAuthToken` indexes as `user`, `auth`, `token`.
- **Symbol-match boost** - files that export a name matching the query rank higher than files that merely mention it. `authenticate` as a function name beats `authenticate` as a comment.
- **Upgraded `projscan_search` MCP tool** - scope `auto` (default, BM25-ranked content + excerpt) joins existing `symbols` / `files` / `content` scopes. Returns ranked matches with file + line + excerpt.
- **New CLI command `projscan search <query>`** - same ranked search from the terminal. Supports `--scope`, `--limit`, and all three output formats.
- **Public API:** `buildSearchIndex`, `search`, `tokenize`, `expandQuery`, `attachExcerpts`.

### Fixed

- **MCP budget sidecar corrupted array responses.** When a tool handler returned an array and the budget truncated it, the server spread the array into `{ ...value, _budget }` - producing `{ "0": …, "1": …, _budget }` garbage. Now wraps non-object values as `{ value, _budget }`.
- **Hotspot ↔ issue linking used fragile substring matching.** Issues about `src/ab.ts` could falsely attach to `src/a.ts`. Now prefers `issue.locations` when present and uses path-boundary guards for the legacy substring fallback.
- **Dead `src/utils/cache.ts` removed** - our own dead-code analyzer flagged it; deleting resolves the finding.

### Changed (dogfooding)

- Added **`.projscanrc.json`** to the repo - ignores the hardcoded-secret test fixture (`tests/analyzers/securityCheck.test.ts`) and disables the `large-utils-dir` rule that we intentionally trip. Demonstrates the config loader on real code.
- Added **`.prettierrc`** and **`.editorconfig`** to resolve the two lingering "missing config" warnings on projscan itself.
- Our own `projscan doctor` score goes from D/51 → A/100. The tool is now healthy by its own standards.

### Notes

- 249 tests passing (+14 new).
- Zero new runtime dependencies.
- All offline, no network.

## [0.6.0] - 2026-04-20

### Theme - "Agent-First"

**projscan is repositioning as an MCP-native code-intelligence tool.** The CLI still works identically; nothing breaks. But the product center of gravity moves to the MCP server, and everything below is in service of that: AI coding agents (Claude Code, Cursor, Windsurf, custom) are now first-class consumers, not an afterthought.

### Added

- **Real AST parsing** via [`@babel/parser`](https://babeljs.io/docs/babel-parser) - replaces regex in `src/core/fileInspector.ts`. Handles JS/TS/JSX/MJS/CTS with decorator, dynamic-import, top-level-await, and error-recovery support. `import type`, re-exports, and dynamic `import()` now captured correctly (regex was missing all three).
- **Code graph** (`src/core/codeGraph.ts`) - new core primitive. Files + exports + imports + call sites, bidirectional edges, built from real ASTs. Relative import resolution covers extension inference, barrel files (`foo/index.ts`), and `.js` specifiers that resolve to `.ts` under NodeNext.
- **Incremental index cache** (`src/core/indexCache.ts`) - mtime-keyed parse cache at `.projscan-cache/graph.json` (auto-gitignored). First run populates; subsequent runs re-parse only changed files. Agent queries against warm caches are millisecond-fast, not second-slow.
- **MCP context-token budgeter** (`src/mcp/tokenBudget.ts`) - every MCP tool call accepts an optional `max_tokens` argument. When set, projscan serializes the result and, if over budget, truncates the largest array field record-by-record until it fits. Ships a `_budget` sidecar on truncated responses so the agent knows it got a partial view.
- **New MCP tool `projscan_graph`** - query the code graph directly. Directions: `imports`, `exports`, `importers`, `symbol_defs`, `package_importers`. Agents can ask "who imports this file?" or "where is `runAudit` defined?" and get an answer in milliseconds without loading 11 other tools.
- **New MCP tool `projscan_search`** - fast structural search. Scopes: `symbols` (exports), `files` (path substring), `content` (source substring with line + excerpt). Replaces the temptation to shell out to `grep`.
- **Public API:** `parseSource`, `isParseable`, `buildCodeGraph`, `filesImportingFile`, `filesImportingPackage`, `filesDefiningSymbol`, `exportsOf`, `importsOf`, `importersOf`, `loadCachedGraph`, `saveCachedGraph`, `invalidateCache`, `applyBudget`, `estimateTokens`.

### Changed

- **`buildImportGraph` is now a compat shim** - backed by AST-based `buildCodeGraph` internally. Accuracy improves (no more regex false negatives), API is unchanged.
- **MCP tools now advertise `max_tokens`** - the new two explicitly, but the dispatcher applies the budget to every tool call whether the schema mentions it or not. Agents can set `max_tokens` on any existing tool (`projscan_hotspots`, `projscan_coverage`, etc.) and get right-sized output.
- **Two new runtime dependencies:** `@babel/parser` (~1.5MB) and `@babel/types`. Deliberate trade-off - regex hit an accuracy ceiling and every downstream analyzer was building on sand. "Real AST parsing" is a 0.6 headline; the zero-heavy-deps claim ends here.

### Fixed (from the AST migration)

- `import type { X }` now captured everywhere. Was silently dropped by the old regex, under-reporting imports in the graph.
- Dynamic `import('./lazy.js')` now captured.
- `export * as ns from './foo.js'` and other re-export shapes now captured.
- Unused-dependency and unused-exports analyzers are measurably more accurate as a side effect - no more flagging files that are reachable via type-only imports or dynamic loads.

### Notes

- **202 → 235 tests** (+33). Every new primitive has dedicated coverage.
- All offline. Cache file is the only disk artifact, lives at `.projscan-cache/`, is gitignored automatically.
- CLI output is unchanged. If you use projscan-the-CLI today, 0.6.0 is a no-op feature bump (with faster subsequent runs thanks to the cache).

## [0.5.0] - 2026-04-20

### Added - "Deeper Signal" theme

- **`projscan coverage`** - parses test coverage from `coverage/lcov.info`, `coverage/coverage-final.json`, or `coverage/coverage-summary.json`, joins it with the hotspot ranking, and surfaces the **scariest untested files**: high-risk × low-coverage. Works with Vitest, Jest, c8, Istanbul - any tool that emits one of the three standard formats.
- **Coverage-weighted hotspot risk** - `computeRiskScore` now takes an optional `coverage` input. Uncovered churning files bubble up the ranking; fully covered files see no change. New reason tags: `low coverage (X%)`, `moderate coverage (X%)`.
- **Dead-code analyzer** - new issue type `unused-exports-<file>`. Builds the full import graph across source, and flags non-barrel / non-test source files whose exports nothing imports. Respects `package.json#main`, `#exports`, `#bin`, `#types`. Handles ESM `import type`, dynamic `import()`, re-exports (`export { x } from ...`), and `.js` specifiers that resolve to `.ts` files under NodeNext.
- **Existing `projscan hotspots` now surfaces coverage** - when a coverage file exists, `hotspots` automatically reads it and includes per-file coverage in the output (no flag needed).
- **`FileHotspot.coverage`** - new optional field on hotspot entries.
- **New MCP tool:** `projscan_coverage`.
- **Public API:** `parseCoverage`, `coverageMap`, `joinCoverageWithHotspots`.
- **New types:** `CoverageSource`, `FileCoverage`, `CoverageReport`, `CoverageJoinedHotspot`, `CoverageJoinedReport`.

### Fixed

- **`extractImports` regex was missing type-only imports** - `import type { X } from './foo.js'` wasn't being captured, which silently under-counted imports in the graph. Now handles:
  - ESM `import type`
  - ESM re-exports (`export { x } from ...`, `export * as y from ...`)
  - Dynamic `import('...')`
  This makes the unused-dependency and unused-export analyzers more accurate.

### Notes

- All coverage parsing is offline and file-based. No runners invoked, no network.
- Coverage is additive - projects without a coverage file get the same hotspot output as before.
- Tests: 202 passing (+17 new).
- Zero new runtime dependencies. Still 4 packages in `dependencies`.

## [0.4.0] - 2026-04-20

### Added - "Dependency Health" theme

- **`projscan outdated`** - offline outdated check. Compares versions declared in `package.json` against the versions actually installed under `node_modules/` and classifies drift (patch / minor / major / same / unknown). No network calls.
- **`projscan audit`** - runs `npm audit --json` and normalizes the output into a projscan-shaped report: severity summary, per-package findings with title/URL/range/fix-available. SARIF output routes every finding into GitHub Code Scanning with `audit-<pkg>` rule IDs, anchored to `package.json`. Graceful messages for yarn/pnpm projects.
- **`projscan upgrade <pkg>`** - preview the impact of upgrading a package, fully offline. Reports semver drift, extracts the relevant section of the package's own `CHANGELOG.md` from `node_modules/<pkg>/`, highlights breaking-change markers (`BREAKING CHANGE`, `deprecated`, `removed support`, `no longer supported`), and lists every file in your source that imports the package.
- **Unused-dependency analyzer** - new issue type `unused-dependency-<name>`. Builds an import graph across all source files (ES imports + CommonJS requires), diffs against declared dependencies, and emits issues anchored to the exact line in `package.json`. Implicit-use allowlist covers typescript, eslint/prettier/vite plugins, types packages, and packages invoked via `package.json` scripts - with a `disableRules` escape hatch for the rest.
- **`package.json` locations on every dependency-related issue** - `dep-risk-*` and `unused-dependency-*` issues now carry `locations: [{ file: 'package.json', line }]`. SARIF upload to GitHub Code Scanning annotates the offending dependency line directly in PR review.
- **3 new MCP tools**: `projscan_outdated`, `projscan_audit`, `projscan_upgrade`.
- **Public API:** `buildImportGraph`, `toPackageName`, `isPackageUsed`, `filesImporting`, `detectOutdated`, `runAudit`, `auditFindingsToIssues`, `previewUpgrade`, `findDependencyLines`, `parseSemver`, `compareSemver`, `semverDrift`.
- **New types:** `SemverDrift`, `OutdatedPackage`, `OutdatedReport`, `AuditSeverity`, `AuditFinding`, `AuditReport`, `UpgradePreview`.

### Changed

- Issue engine now includes the unused-dependency analyzer alongside the six existing checks.
- `dep-risk-*` issues now carry `package.json` locations (line-level for package-specific risks, file-level for project-level risks like `excessive-dependencies`).

### Notes

- Everything in 0.4.0 is **offline-first** - no registry calls, no changelog fetching from GitHub. `projscan upgrade` reads the CHANGELOG that npm already placed in your `node_modules/<pkg>/`. Network-fetching upgrade preview is deferred to a later release.
- Zero new runtime dependencies. Still 4 packages in `dependencies`.
- Tests: 185 passing (+37 new).

## [0.3.1] - 2026-04-20

### Changed

- **Docs: thorough pass for 0.3.0 features.** `docs/GUIDE.md` rewritten to cover `hotspots`, `file`, `mcp`, SARIF output, `.projscanrc` config, and `--changed-only` PR-diff mode - plus a dedicated Configuration section, an updated Global Options table, an expanded CI/CD Integration section covering the first-party GitHub Action, and a refreshed Project Internals directory map. Fixed a stale note that claimed "no `.projscanrc` file needed."
- **README: quick-start examples surface `--changed-only` and `--format sarif`** so 0.3.0's CI-native story is visible above the fold.
- **CLI banner and help text refreshed:** `projscan help` now lists `hotspots`, `file`, `mcp`, `ci --changed-only`, and `ci --format sarif`; global-options table now documents `--config`, `--changed-only`, `--base-ref`, and `sarif` as a valid `--format`. "What's new" panel updated to 0.3.0's headline features.
- **CONTRIBUTING.md:** project structure tree fixed (`fixers/` → `fixes/`, added `core/` and `mcp/`, listed the new SARIF reporter, config loader, and changed-files helper).

### CI

- **Publish workflow hardened** - checks out the tagged ref (not HEAD of main), verifies `package.json` version matches the tag before publishing, adds `workflow_dispatch` so a failed publish can be retried without cutting a new release, and adds a concurrency guard against racing re-runs.
- **Node bumped to 22** across the publish workflow and the CI matrix (now 20 / 22 / 24). Node 20 is being deprecated on GitHub-hosted runners in June 2026. `engines` stays at `>=18` for install compatibility.

No runtime behavior changes. No API changes.

## [0.3.0] - 2026-04-20

### Added

- **SARIF output** (`--format sarif`) - emit SARIF 2.1.0 from `analyze`, `doctor`, and `ci`. Feeds directly into GitHub Code Scanning (and any other SARIF consumer), so projscan findings show up in the Security tab as annotated results with file/line locations.
- **`--changed-only` mode** - restrict `analyze`, `doctor`, and `ci` to issues in files changed vs a base ref. `--base-ref <ref>` overrides the default (auto-detects `origin/main` → `origin/master` → `main` → `master` → `HEAD~1`). Makes PR CI runs ~10× faster and only gates on issues the PR introduced.
- **`.projscanrc` config** - load project-wide defaults from `.projscanrc.json`, `.projscanrc`, or a `"projscan"` key in `package.json`. Supports:
  - `minScore` - default threshold for `ci`.
  - `baseRef` - default base ref for `--changed-only`.
  - `hotspots.limit`, `hotspots.since` - defaults for `hotspots`.
  - `ignore` - extra glob patterns layered onto the built-in ignore list.
  - `disableRules` - silence rules by id (supports `rule-id` or wildcard `prefix-*`).
  - `severityOverrides` - remap a rule's severity (`info` / `warning` / `error`).

  CLI flags always win over config; use `--config <path>` to load a specific file.
- **First-party GitHub Action** (`action.yml`) - composite action that installs projscan, runs `projscan ci --format sarif` (optionally `--changed-only`), writes a SARIF file, uploads to GitHub Code Scanning, and exposes `score` / `grade` outputs plus a Job Summary.
- **Issue locations** - `Issue` now carries optional `locations: IssueLocation[]` (file, line, column). Security checks populate real file/line locations (including line numbers for hardcoded secrets), and architecture checks anchor large-dir issues to their directory. Used by SARIF, `--changed-only`, and future file-centric outputs.
- Public API: `loadConfig`, `applyConfigToIssues`, `getChangedFiles`, `issuesToSarif`.
- New types: `IssueLocation`, `ProjscanConfig`, `LoadedConfig`.

### Changed

- `scanRepository(rootPath, { ignore })` now accepts optional ignore globs that layer onto the built-in list. The CLI passes `config.ignore` through automatically.
- `projscan ci` no longer hard-codes `--min-score 70`; missing flag falls back to `config.minScore`, then to 70.
- `ReportFormat` type now includes `'sarif'`.

## [0.2.0] - 2026-04-19

### Added

- **`projscan hotspots`** - ranks files by risk using `git log` churn × complexity (lines of code) × open issues × recency. Turns a flat health score into a prioritized "fix these first" list. Graceful fallback when the project is not a git repository.
- **`projscan file <path>`** - per-file drill-down combining the file's purpose, imports, exports, hotspot risk data, ownership, and the health issues that reference it. Natural follow-up to `projscan hotspots`.
- **`projscan mcp`** - runs projscan as an MCP (Model Context Protocol) server over stdio. Now exposes:
  - **Tools** (7): `projscan_analyze`, `projscan_doctor`, `projscan_hotspots`, `projscan_file`, `projscan_explain`, `projscan_structure`, `projscan_dependencies`.
  - **Prompts** (2): `prioritize_refactoring` (ranked plan grounded in live hotspots), `investigate_file` (senior-engineer brief for a specific file).
  - **Resources** (3): `projscan://health`, `projscan://hotspots`, `projscan://structure` - readable by agents on demand.
- **Ownership / bus-factor analysis** - hotspots now include `primaryAuthor`, `primaryAuthorShare`, `topAuthors`, and a `busFactorOne` flag (single-author + high churn ⇒ organizational risk). Bus-factor-1 files add a score penalty and a reason tag.
- **Hotspot trend tracking** - `.projscan-baseline.json` now snapshots top hotspots; `projscan diff` reports hotspots that *rose*, *fell*, *appeared*, or were *resolved* since the baseline (alongside existing issue deltas).
- Public API: `analyzeHotspots`, `computeRiskScore`, `inspectFile`, `createMcpServer`, `runMcpServer`, `getToolDefinitions`, `getPromptDefinitions`, `getResourceDefinitions`.
- New types: `FileHotspot`, `HotspotReport`, `AuthorShare`, `FileInspection`, `BaselineHotspot`, `HotspotDelta`, `HotspotDiffSummary`, `McpToolDefinition`, `McpPromptDefinition`, `McpResourceDefinition`.

### Changed

- `projscan diff --save-baseline` now captures a hotspot snapshot too, enabling trend analysis on subsequent diffs.
- Explain/file parsing logic (imports, exports, purpose inference) extracted into a shared `fileInspector` module used by both the CLI and MCP server - removes ~150 lines of duplication.

## [0.1.3] - 2026-03-11

### Added

- Health scoring system: every `projscan doctor` run now shows an A/B/C/D/F grade (0–100 score)
- `projscan badge` command: generates shields.io badge URL and markdown for READMEs
- Score integrated into all output formats (console, JSON, markdown)
- Automated npm publish workflow (GitHub Actions on Release)
- CONTRIBUTING.md, CHANGELOG.md, GitHub issue templates, CI workflow

## [0.1.0] - 2026-03-11

### Added

- `projscan analyze` - full project analysis (languages, frameworks, dependencies, issues)
- `projscan doctor` - project health check with actionable recommendations
- `projscan fix` - auto-fix for missing ESLint, Prettier, Vitest, and .editorconfig
- `projscan explain <file>` - file-level explanation (purpose, imports, exports)
- `projscan diagram` - ASCII architecture diagram
- `projscan structure` - directory tree visualization
- `projscan dependencies` - dependency audit and risk analysis
- Multiple output formats: console, JSON, markdown
- Detection for 30+ languages and 15+ frameworks
- Performance: 5k files in <1.5s, 20k files in <3s
