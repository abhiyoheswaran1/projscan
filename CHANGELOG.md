# Changelog

All notable changes to projscan are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] — 2026-05-06

Theme: **"Operator"** — projscan grows from a *report-and-suggest* tool into a *report-and-act* tool, and learns to look across repository boundaries. Three pillars in one release: cross-repo intelligence over registered sibling repos, an apply layer that mechanically executes the safest fix templates with rollback support, and a security-aware review that surfaces newly-introduced source-to-sink taint flows.

### Added — cross-repo intelligence (Pillar 1)

- **`projscan workspace add | list | remove` CLI.** Register sibling repository paths under a workspace root. State persists at `<root>/.projscan-workspace.json` (auto-gitignored), schema-versioned for forward evolution. Each registered repo gets a stable name (defaults to its directory name) and an absolute path; duplicates are detected up-front.
- **`projscan_workspace_graph` MCP tool.** Cross-repo intelligence over the registered siblings. Three subactions:
  - `list` — registered repos with parsed-file counts and exported-symbol counts.
  - `graph` — every symbol exported by ≥ 2 registered repos (a candidate refactor / API contract surface).
  - `file_importers` — given a file in one registered repo, list every other repo whose graph imports it.
- **`projscan_impact` cross-repo mode.** New `cross_repo: true` arg (CLI: `--cross-repo`) folds the registered sibling graphs into impact analysis: the response gains a `repo` field per node and a `totalReachableByRepo` aggregate, so an agent can answer "if I rename this exported function, what changes across every registered repo?"
- **`projscan coverage --changed-only`** + **`--base-ref <ref>`.** Restrict the coverage report to files changed against a git base ref (auto-detected when omitted). Speeds up the per-PR loop where you only want hotspots in the diff.

Naming note: `projscan_workspaces` (plural) remains the intra-repo monorepo tool — workspace packages within a single codebase. `projscan_workspace_graph` (singular concept, "the workspace graph") is the new cross-repo tool. The split is deliberate; the docs call it out so agents pick the right one.

### Added — apply layer (Pillar 2)

The diagnose-fix loop closes mechanically for the safe templates.

- **`projscan_apply_fix` MCP tool + `projscan apply-fix <issue_id>` CLI.** Default is dry-run — returns the would-change list without writing. Pass `confirm: true` (`--confirm`) to actually mutate disk. Atomic writes (write-to-tmp + rename), per-apply rollback record persisted at `.projscan-cache/rollbacks/<id>.json`. Reverse with `action: "rollback", rollback_id: ...` or `projscan apply-fix --rollback <id>`. Refusal guards reject absolute paths, `..` traversal, create-over-existing, and modify-non-existent.
- **Apply support for six mechanical fix templates.** `unused-dependency-*` (patches the right `package.json`), `missing-test-framework` (vitest config + smoke test), `missing-eslint` (`eslint.config.js`), `missing-prettier` (`.prettierrc`), `missing-editorconfig` (`.editorconfig`), `missing-readme` (README skeleton). Templates without apply support return `applicable: false` and point at `projscan_fix_suggest` for the structured guidance — no codemods, no semantic rename, no inference.
- **`projscan init` CLI.** Scaffolds `.projscanrc.json` with sensible defaults (`{minScore: 70, hotspots: {limit: 10}, ignore: [], disableRules: []}`). Idempotent — refuses to overwrite an existing config without `--force`.
- **`projscan install-hook --threshold <n>` CLI.** Writes `.git/hooks/pre-commit` running `npx projscan ci --changed-only --min-score <n>`. One-line CI gate without touching CI config.

### Added — security-aware review (Pillar 3)

- **`projscan_taint` MCP tool + `projscan taint` CLI.** Source-to-sink reachability over the per-function call graph. Each flow lists `sourceFn`, `sinkFn`, the matched source/sink names, the path, and the files it traverses. BFS over per-function `callSites` + member-expression reads, capped at 8 hops, deduped by `(sourceFn, sinkFn)`.
- **Built-in source/sink defaults.** Common JS / Python sources (`process.env`, `req.body`, `req.query`, `req.params`, `req.headers`, `req.cookies`, `readFile`, `readFileSync`, `process.stdin`, `getInput`) and sinks (`exec`, `execSync`, `spawn`, `spawnSync`, `eval`, `Function`, `writeFile`, `writeFileSync`, `unlink`, `rm`, `rmSync`, `query`, `execute`, `os.system`, `subprocess`, `innerHTML`).
- **`.projscanrc.json` `taint` block.** `taint.sources` and `taint.sinks` arrays MERGE with the defaults — they don't replace them. Use this to add project-specific names: `runRawSql`, `dangerouslyEval`, `customSecretReader`, etc. To suppress a default, list `taint-flow-detected` under `disableRules`.
- **`projscan_review` taint integration.** The review now diffs taint flows between base and head: any `(sourceFn, sinkFn)` pair that exists at head and didn't at base surfaces as `newTaintFlows`. **A new taint flow forces the verdict to `block`** — the strongest signal in the review verdict. Surfaced in the `summary` line as the lead concern (e.g. `2 new taint flow(s) detected: env→exec (run), body→query (handler), …`).
- **`review_this_pr` prompt updated.** Taint flows are now the lead concern in the PR review template — agents are asked to name the flow, explain the exploit shape, and demand neutralization or justification before approving.

### Changed

- **MCP tool count: 22 → 25** (added `projscan_workspace_graph`, `projscan_apply_fix`, `projscan_taint`).
- **CLI commands: 24 → 28** (added `projscan workspace`, `projscan apply-fix`, `projscan init`, `projscan install-hook`, `projscan taint`).
- **`ReviewReport` gains required `newTaintFlows: ReviewTaintFlow[]` field** (1.6+). New type `ReviewTaintFlow` exported.
- **`ImpactReport` gains optional `totalReachableByRepo?: Record<string, number>`** (1.6+, present only when `cross_repo: true`).
- **`ImpactNode` gains optional `repo?: string`** (1.6+).
- **`ProjscanConfig` gains optional `taint?: { sources?: string[]; sinks?: string[] }`** (1.6+).
- **`FunctionInfo` gains optional `references?: string[]`** (1.6+) — rightmost identifiers from member-expression reads in non-callee position. Powers taint source detection (e.g. `process.env.X` registers `env`). JavaScript / TypeScript only at this release; other adapters omit it and taint matches call-shaped sources only for those files.
- **Cache version bump v4 → v5.** `.projscan-cache/graph.json` written by 1.5 is discarded on first 1.6 run so the new `references` field is populated for every parsed function.
- New public exports from `src/core/taint.ts`: `computeTaint`, `TaintConfig`, `TaintFlow`, `TaintReport`, `DEFAULT_TAINT_SOURCES`, `DEFAULT_TAINT_SINKS`.
- New public exports from `src/core/applyFix.ts`: `executePlan`, `rollback`, `ApplyResult`, `ApplyPlan`, `ApplyChange`.
- New public exports from `src/core/workspace.ts`: `loadWorkspace`, `loadOrCreateWorkspace`, `addRepo`, `removeRepo`, `saveWorkspace`, `Workspace`, `WorkspaceRepo`.
- `buildApplyPlanForIssue(issue, rootPath)` and `pickManifestPath(rootPath, issue)` exported from `src/core/fixSuggest.ts`.

### Notes

- All additions pass the stability check. The `newTaintFlows` field on `ReviewReport` is required at the type level but defaults to `[]` for unavailable reports — existing callers that read the report without checking `available` will see an empty array, never a missing field.
- Taint analysis is intentionally heuristic: it answers "does some call chain reach from a function reading a source to a function calling a sink?" not "is this variable actually tainted at the sink?" False positives are expected for functions that launder taint safely; false negatives happen for flows through `eval`'d strings or plugin loaders. Tune by adding sinks under `.projscanrc.json` `taint.sinks` and silencing rules under `disableRules`.
- No new runtime dependencies.

## [1.5.0] — 2026-05-05

Theme: **"Budgeted by default"** — every tool reports a token-cost estimate, `projscan_review` adapts its response shape to the budget the caller asks for, a new set of specialist prompts lets agents invoke a tested composition of tools by name, and projscan now learns from how you use it on this specific repo and quiets down the noise over time.

### Added — cost-aware tool composition

- **`_cost` sidecar on every tool result.** The MCP server attaches `_cost: { estimatedTokens: N }` to every `tools/call` response automatically. Agents can see what they paid for a call without counting tokens themselves, which makes it cheap to budget tool sequences. Cost is the chars-divided-by-4 approximation of the serialized payload — within roughly ±15% of GPT/Claude tokenizers for code-shaped output.
- **`max_cost_tokens` arg on `projscan_review`** — adaptive shape budget. The tool picks a tier and reshapes the response *before* serializing, so an agent on a tight budget gets a response sized to fit instead of a truncated full one. Three tiers:
  - **full** (no budget, or budget ≥ 7000): everything — full structural diff, per-changed-file lists, all cycles, all risky functions, all dependency changes.
  - **summary** (3000-6999): verdict + summary + top-5 changed files + top-3 of each list (cycles, risky functions, deps), with the heavy per-file expansion arrays (exports added/removed, imports added/removed, calls added/removed) stripped. Aggregate `totals` included.
  - **verdict-only** (<3000): verdict + summary + base/head + aggregate `totals`. Roughly 500 tokens, suitable for very tight budgets.
  The chosen tier is surfaced as a top-level `tier` field on the response and lifted into `_cost.tier` so an agent sees it in one place.
- **Coexistence with `max_tokens`.** `max_cost_tokens` shapes; `max_tokens` truncates. Agents can use either, both, or neither. When both fire, the shaped result is also truncated, and both `_cost` and `_budget` sidecars appear on the response.

### Added — specialist prompts

Four new MCP prompts that compose existing tools into a single agent-callable recipe. Each returns a templated user message pre-filled with live project data, so the agent gets a primed prompt instead of having to orchestrate the underlying tools itself:

- **`refactor_hotspot`** — given a hotspot file, produces a step-by-step refactor plan. Pulls the file detail (purpose, risk score, ownership, per-function CC, related issues) and asks for ordered changes plus risk acknowledgement. Args: `file` (required).
- **`triage_doctor_issues`** — orders the open health issues by what to fix first. Groups by category, surfaces score impact, and asks for a "critical / important / backlog" plan with a concrete next-action per item. Args: `severity` (optional: `error` / `warning` / `info` / `all`).
- **`review_this_pr`** — primes the agent with the structural diff, per-file risk, new cycles, risky function additions, and the verdict from `projscan_review`. Asks for a PR-comment-ready review in priority order with an approve / request-changes / comment recommendation. Args: `base`, `head`, `package` (all optional).
- **`safely_rename_symbol`** — produces an ordered safe-rename checklist for an exported symbol. Pulls the definition site(s), every direct caller, and the transitive blast radius via `projscan_impact`, then asks for a sequenced plan that minimizes risk. Args: `symbol` (required), `to` (optional new name).

### Added — Project Memory

A local feedback loop that learns which analyzer rules this specific repo has been carrying across many runs and surfaces them as candidates to silence — without phoning home, without an LLM, without ever leaving your machine.

- **Persistent on-disk store at `.projscan-memory/memory.json`** (auto-gitignored). Records, per analyzer rule id: when it first surfaced, when it was last seen, how many runs surfaced it, how many runs *fixed* it (rule appeared then disappeared), and whether the user explicitly suppressed it via `.projscanrc disableRules`. Schema is versioned for forward evolution.
- **Auto-recorded on every `projscan doctor` / `projscan ci` / `projscan analyze` run.** The issue engine folds the run's rule ids into memory as a best-effort side effect; transient disk failures are swallowed so memory never breaks the analyzer pipeline. Stale rules (unseen for ≥ 90 days) are aged out automatically.
- **`projscan_memory` MCP tool + `projscan memory` CLI.** Subactions:
  - `current` — aggregate counts (total runs, rules tracked, stable-rule count, last update).
  - `stable` — rules surfaced across ≥ 3 runs over ≥ 7 days without ever being fixed and not already suppressed. Returns the list plus a ready-to-paste `.projscanrc.json` `disableRules` snippet so you can quiet them in one move.
  - `runs` — every tracked rule with its full observation history.
  - `forget` — drop a single rule's history. Useful when you genuinely want a rule to start over.
- **Privacy-preserving by design.** Memory only stores rule ids and timestamps. No source content, no agent identity, no machine identifiers. The store is a sibling of `.projscan-cache/` and follows the same privacy posture: local-only, gitignored, deletable.

### Changed

- `ReviewReport` gains optional `tier` field (1.5+; absent for legacy callers that don't pass `max_cost_tokens`).
- New public functions `selectReviewTier(maxCostTokens)` and `shapeReviewForTier(report, tier)` exported from the review module.
- New public functions `loadMemory(rootPath)`, `saveMemory(rootPath, memory)`, `recordRun(memory, ids, suppressed)`, `findStableRules(memory)`, `forgetRule(memory, ruleId)` exported from the memory module.
- **MCP tool count: 21 → 22** (added `projscan_memory`).
- **CLI commands: 23 → 24** (added `projscan memory` with three subcommands).
- **MCP prompt count: 2 → 6.**

### Added — extending the loop

- **`projscan_doctor` adaptive shaping.** Same three-tier pattern that `projscan_review` shipped with: pass `max_cost_tokens` and the doctor reshapes its response *before* serializing. <3000 returns verdict-only (score + grade + per-severity counts); <7000 returns a summary (top-5 issues by severity, no descriptions); otherwise the full issue list. The chosen tier is surfaced as `tier` and lifted into `_cost.tier`.
- **Doctor surfaces stable-rule tip from Project Memory.** When memory has accumulated ≥ 1 stable rules, the console doctor output includes a one-line tip: "N rules have been open across enough runs to count as accepted. Run `projscan memory stable` to review and silence them." Closes the feedback loop without requiring the agent to know about `projscan_memory`.
- **`quiet_the_doctor` specialist prompt** *(prompt #7)*. Reads Project Memory's stable-rule list, frames a PR-ready proposal: per-rule rationale, the exact `.projscanrc.json` patch, a verification command, and a rollback note. Single MCP call → committable change.
- **Hotspot acceptance memory (Project Memory's second loop).** `projscan hotspots` now records the top-K into memory on every run. Files that have ranked top-K for ≥ 5 runs over ≥ 7 days without their CC/churn improving are marked `accepted` — the hotspot reporter tags them as `[accepted]` instead of repeated noise. Surfaced via the new `projscan_memory { action: "accepted" }` subaction.

### Security

- **Pulled in CVE patches via `package.json` overrides.** Five transitive vulnerabilities patched without bumping any direct dependency: `protobufjs` 6.11.5 → 7.5.6 (CVE-2026-41242, RCE in protobuf decoders), `picomatch` 2.3.1 → 2.3.2 (ReDoS in extglob), `brace-expansion` 5.0.4 → 5.0.5 (ReDoS via zero-step), `flatted` 3.4.1 → 3.4.2 (prototype pollution), `postcss` 8.5.8 → 8.5.10 (XSS via stringify). Five remaining `npm audit` alerts are all in the vitest 2.1 dev chain — dev-only, never ships to end users.

### Changed

- `ReviewReport` gains optional `tier` field (1.5+; absent for legacy callers that don't pass `max_cost_tokens`).
- `FileHotspot` gains optional `accepted: boolean` field (1.5+).
- `ProjectMemory` gains optional `hotspots` field (1.5+; backward-compatible — older saves are migrated on load).
- New public functions `selectReviewTier(maxCostTokens)`, `shapeReviewForTier(report, tier)`, `recordHotspots(memory, top)`, `findAcceptedHotspots(memory)`, `forgetHotspot(memory, file)`.
- New public functions `loadMemory(rootPath)`, `saveMemory(rootPath, memory)`, `recordRun(memory, ids, suppressed)`, `findStableRules(memory)`, `forgetRule(memory, ruleId)` exported from the memory module.
- **MCP tool count: 21 → 22** (added `projscan_memory`).
- **CLI commands: 23 → 24** (added `projscan memory` with three subcommands).
- **MCP prompt count: 2 → 7.**

### Notes

- The `_cost` sidecar is additive; `max_cost_tokens` is a new optional arg on existing tools; the new prompts are additive in the `prompts/list` response; the new `projscan_memory` tool is additive. All pass the stability check.
- Project Memory now has both feedback loops in production: stable-rule detection and hotspot acceptance. Per-rule confidence weighting (the third loop) is still on the deferred list — needs more longitudinal data to tune.
- No new runtime dependencies.

## [1.4.0] — 2026-05-05

Theme: **"Session"** — durable cross-invocation state so multiple agent calls (or multiple agents) can see what's been touched in the current session without re-querying git.

### Added

- **`projscan_session` MCP tool + `projscan session` CLI.** New durable session, persisted at `.projscan-cache/session.json`. A new session starts when no previous session exists or when the previous session has been idle for more than 1 hour (configurable). Multiple agents working in the same project share the same session. Subactions:
  - `current` — session metadata (id, started/last-activity timestamps, touched-file count, event count).
  - `touched` — list of files touched in this session, sorted by last-touched descending. Filterable by source (`tool-result`, `fs-watch`, `explicit`). Cursor-paginated.
  - `events` — chronological event log, newest first. Bounded to the most recent 500 entries.
  - `reset` — discard the current session and start a fresh one.
- **Auto-touch from tool results.** Every MCP `tools/call` response is scanned for repo-relative file paths (under fields like `file`, `relativePath`, `paths`, `filePath`, `definitions`, `importers`, `reachable`). Found paths land in the session's `touchedFiles` map with source `tool-result`. The `projscan_session` tool itself is excluded so reading the session doesn't pollute it.
- **Auto-touch from `notifications/file_changed`.** When `projscan mcp --watch` is on, every debounced batch from the file watcher also records the changed paths into the session with source `fs-watch`. Agents can now ask "what's changed on disk during my session?" via `projscan_session { action: "touched", source: "fs-watch" }`.
- **CLI mirror.** `projscan session` (default subcommand: `current`), `projscan session touched`, `projscan session events`, `projscan session reset`. Supports `--format json` for scripting and `--limit N` on the list views.

### Changed

- **MCP tool count: 20 → 21** (added `projscan_session`).
- **CLI commands: 22 → 23** (added `projscan session` with four subcommands).

### Notes

- The session is best-effort: write failures (full disk, permission issues) are swallowed so a transient error never breaks a tool call. Last-write-wins if two MCP servers run against the same repo concurrently.
- Schema is versioned (`schemaVersion: 1`); future changes will detect and migrate older session files instead of crashing.
- No new runtime dependencies. All session state lives in `.projscan-cache/session.json`, alongside the existing graph cache.

## [1.3.0] — 2026-05-05

Theme: **"Push, Don't Poll"** — long-running agents stop polling for repo state; the MCP server pushes file-change notifications instead.

### Added

- **MCP `notifications/file_changed`.** Run `projscan mcp --watch` and the server starts a debounced file watcher over the repo. On every batch it emits a JSON-RPC notification with the changed paths, post-update graph size, and a timestamp. Capability advertised under `experimental.fileChanged` on `initialize`. Off by default.
- **`projscan upgrade --check-registry`.** Optional network fetch from `registry.npmjs.org/<pkg>/latest` so the preview's "latest" reflects what's actually current, not just what's installed. Default stays offline; failures fall back gracefully with a `registryError` field. Same opt-in works through MCP via `projscan_upgrade { check_registry: true }`.

### Changed

- `runMcpServer(rootPath, options)` accepts `{ watch?: boolean }`. Backwards-compatible.
- `createMcpServer` returns a `close()` method to stop active watchers.

## [1.2.1] — 2026-05-05

### Changed

- Replaced the nine command-demo screenshots in the README with animated GIFs.

## [1.2.0] — 2026-05-05

Theme: **"Reporter Parity"** — two new languages, HTML reporters across diff and coverage, and per-function fan-out.

### Added

- **PHP as a first-class language.** AST analysis for `.php` files: imports (`use`, brace lists, aliases, `require`/`include`), public exports (`function`, `class`, `interface`, `trait`, `enum`), file-level and per-function cyclomatic complexity, and call sites. Resolves namespaces via `composer.json` PSR-4 autoload (longest-prefix-match).
- **C# as a first-class language.** AST analysis for `.cs` files with the same primitives. Imports cover `using`, dotted, aliased, and `using static`. Exports are public top-level types (`class`, `record`, `struct`, `interface`, `enum`, `delegate`). Reads `.csproj` files; the project's filename stem is treated as the root namespace and stripped from imports before mapping to a path.
- **HTML reporter for `projscan pr-diff`** (`--format html`). Self-contained page with a sortable table of changed files plus the diff hotlist. Suitable for CI artifact uploads.
- **HTML reporter for `projscan coverage`** (`--format html`). Highlights "scariest untested files" — rows where coverage < 50% AND risk > 50 surface as a `danger` row.
- **Per-function fan-out across all language adapters.** `FunctionInfo.callSites` carries the bare names of internal callees from each function body (deduped, nested functions excluded). `FunctionInfo.fanOut` is the count of those callees that resolve to a function defined elsewhere in the graph.

### Changed

- Languages with full AST: 7 → 9 (PHP and C# added).

## [1.1.1] — 2026-05-04

### Fixed

- `unusedDependencyCheck` no longer flags `tree-sitter-*` packages. These ship a `.wasm` grammar that consumers vendor via a build script rather than `import`, so the analyzer couldn't see usage. Affects every project depending on tree-sitter through the wasm-vendor pattern.

## [1.1.0] — 2026-05-04

Theme: **"On the Map"** — closes the highest-leverage parity gaps.

### Added

- **Rust as a first-class language.** AST analysis for `.rs` files via tree-sitter-rust. Imports cover plain `use`, brace lists, aliases, glob (`use foo::*`), and re-exports (`pub use`). Exports are public-by-keyword for `fn`, `struct`, `enum`, `union`, `trait`, `type`, `const`, `static`, `mod`. Per-function CC names methods inside `impl Type { fn m() }` as `Type.m`. Reads `Cargo.toml`, including `[workspace]` member resolution. `crate::`, `self::`, `super::` paths resolve into the repo; standard-library and crates.io paths classify as external.
- **`projscan_fix_suggest` template for `eslint-*` issue ids.** Pulls the rule name out of the id (`eslint-no-unused-vars` → `no-unused-vars`) and links to the canonical `https://eslint.org/docs/latest/rules/<rule>` page. Instruction covers fix-per-docs, scoped `eslint-disable-next-line` with rationale, or a config change in priority order.
- **`projscan_fix_suggest` template for `python-type-error-*` issue ids.** Covers mypy and pyright output with annotation refinement, type narrowing (`isinstance`, `is not None`), and the typed-ignore form `# type: ignore[<error-code>]` (preferring pinned codes over bare ignores).

### Changed

- Languages with full AST: 6 → 7 (Rust added).

## [1.0.0] — 2026-05-04

The public no-break commitment release.

The stable surface — MCP tool names + input schemas, CLI command names + documented flags, exit codes, and JSON output keys — is now under semver protection. Breaking it requires a 2.0 with a deprecation cycle (one minor with a stderr warning, then removal in the next major).

This is a label release: the git tree at `v1.0.0` is identical to `v0.17.0` except for the version field and declarative-language touch-ups in the README.

## [0.17.0] — 2026-05-02

### Added

- Documentation reorganized around the agent journey: diagnose → review → fix → reach → live.

### Deprecated

- `extractImports` / `extractExports` regex helpers in `fileInspector` are now annotated `@deprecated`. They remain in place because two `projscan_explain` callers still use them as a JS/TS-only fallback when a code graph isn't supplied. The graph-based path is strictly better and is already the primary path. Scheduled for removal in a future release.

## [0.16.0] — 2026-04-30

Theme: **"Live"** — keeps the index fresh while the agent works, and unblocks PR-comment / CI-artifact sharing with a standalone HTML report.

### Added

- **`projscan watch` CLI command.** Long-running watcher over the repo using `node:fs.watch` (no new runtime dependency). On change, debounces 200 ms then runs the incremental graph update and re-runs `doctor`, printing a one-line status. Filters `.git`, `node_modules`, `dist`, `.projscan-cache`, and similar so noise doesn't trigger re-scans. Clean shutdown on `SIGINT` / `SIGTERM`.
- **`incrementallyUpdateGraph(graph, rootPath, changedPaths[])` public API.** Targeted re-parse of the listed paths followed by an O(N) rebuild of the cross-file derived indexes. Returns the same graph reference (in-place update).
- **HTML report export (`--format html`).** Renderers for `doctor`, `hotspots`, `coupling`, `review`, and `impact`. Single self-contained HTML document with inline CSS, no external assets, and a `prefers-color-scheme` aware palette.

### Changed

- `ReportFormat` widened from `'console' | 'json' | 'markdown' | 'sarif'` to also include `'html'`.

## [0.15.0] — 2026-04-27

Theme: **"Reach"** — answers the question *what breaks if I change this?* before the agent commits to a refactor.

### Added

- **`projscan_impact` MCP tool + `projscan impact` CLI.** Transitive blast-radius analysis. Two modes:
  - **File mode**: pass a repo-relative path; returns every file that transitively imports it, ranked by BFS distance.
  - **Symbol mode**: pass a symbol name; returns the file(s) that define it, the files that directly call it, and the transitive importers of those callers.
  Cycle-safe; depth-bounded by `max_distance` (default 10) with a `truncated` flag when the limit is hit. Use this BEFORE renaming or deleting an export.
- **Per-function fan-in.** `FunctionInfo` and `FunctionDetail` gain optional `fanIn?: number`. Counts how many other files include the function's bare name in their call sites. Useful as a "is anyone using this?" signal.
- **Sub-file embeddings.** Opt-in semantic-search mode that embeds each function separately instead of each file. Set `sub_file: true` on `projscan_search` (or `--sub-file` on the CLI) when running in semantic mode. Hits return a `function: { name, startLine, endLine }` field pointing at the matched function.

### Changed

- MCP tool count: 19 → 20 (added `projscan_impact`).
- Semantic-search cache version bumped; old caches are discarded silently and rebuilt on first run.

## [0.14.0] — 2026-04-26

Theme: **"Agent Fix Loop"** — closes the diagnose → fix half of the agent's loop. projscan was already great at telling agents *what's wrong*; now it tells them *what to do about it*, in structured form.

### Added

- **`projscan_fix_suggest` MCP tool + `projscan fix-suggest` CLI.** Rule-driven action prompt for any open issue. Input: an `issue_id` (from `projscan_doctor` / `projscan_analyze`) OR a `file` + `rule` pair. Output: a structured `FixSuggestion` with `headline`, `why`, `where`, `instruction`, and optional `suggestedTest` / `relatedFiles` / `references`. Hand-tuned templates for ~12 common issue id families plus a severity-anchored generic fallback. **No LLM inside projscan** — the driving agent is the LLM, and projscan supplies the structured prompt.
- **`projscan_explain_issue` MCP tool + `projscan explain-issue` CLI.** Deep-dive on one open issue: severity, surrounding code excerpt, other open issues touching the same file, similar past commits via `git log --grep=<rule>`, plus the structured `FixSuggestion`.
- **Inline `suggestedAction` on issues.** Each issue from `projscan_doctor` and `projscan_analyze` carries an optional `suggestedAction: { summary }` field. Console and markdown reporters surface it inline (`→ <hint> (projscan fix-suggest <id>)`).
- **Cross-package import policy analyzer for monorepos.** Reads `.projscanrc` `monorepo.importPolicy: [{from, allow?, deny?}]` and walks cross-package edges. Each violation surfaces as a `cross-package-violation-N` issue (severity warning, category architecture). Glob support: `*`, `pkg/*`, `*/sub`. Off by default; capped at 50 violations per run.

### Changed

- MCP tool count: 17 → 19 (added `projscan_fix_suggest`, `projscan_explain_issue`).

## [0.13.0] — 2026-04-26

Theme: **"Agent Review"**

### Added

- **`projscan_review` MCP tool + `projscan review` CLI.** One-call PR review for the agent: composes the structural diff with per-changed-file risk scores, new/expanded import cycles, risky function additions (high-CC adds or significant CC jumps), and dependency changes across the root and every workspace manifest. Returns a verdict (`ok` | `review` | `block`) and a one-line summary. Defaults: `base=origin/main` (falls back to main/master/`HEAD~1`), `head=HEAD`. `--package <name>` (or `package` MCP arg) scopes to a single workspace. Markdown reporter output is suitable for posting as a PR comment.
- **Per-function cyclomatic complexity.** `LanguageAdapter.parse()` returns `functions: [{name, line, endLine, cyclomaticComplexity}]` for every adapter. Names are qualified for methods (`Class.method`), constructors (`Class.<init>` for Java), and Go methods (`Receiver.Method`). Surfaced via `projscan_file` and a new `view: "functions"` arg on `projscan_hotspots` that flattens results into the top-N riskiest functions.
- **Cycle promotion to `projscan_doctor`.** Tarjan-detected circular imports lift from coupling output into the doctor issue list as `cycle-detected-N` issues (severity warning, category architecture). Each cycle yields one issue with up to 8 file locations; capped at 20 cycles per run.
- **Workspace-aware `dependencies` and `audit`.** `--package <name>` flag (CLI) and `package` arg (MCP) scope to a single workspace. `DependencyReport` gains an optional `byWorkspace` field; `DependencyRisk` gains an optional `workspace` field. Backwards-compatible — both absent for single-package repos.

### Changed

- MCP tool count: 16 → 17 (added `projscan_review`).
- Cache version bumped to persist per-function CC; old caches discarded on first run.

## [0.12.0] — 2026-04-25

### Added

- **Java as a first-class language.** AST analysis for `.java` files via tree-sitter-java. Imports cover typed (`import java.util.List;`), wildcard (`import java.util.*;`), and static (`import static java.lang.Math.PI;`) forms. Exports are public top-level types (`class`, `interface`, `enum`, `record`, `annotation_type`). Source-root resolution prefers conventional Maven/Gradle layouts (`src/main/java`, `src/test/java`).
- **Ruby as a first-class language.** AST analysis for `.rb` files via tree-sitter-ruby. Imports cover `require`, `require_relative`, `load`, `autoload`. Exports are top-level `class`, `module`, `def`. Project layout detection covers gem (`Gemfile` / `*.gemspec` → `lib/`), Rails (`config/application.rb` → `app/`, `lib/`, `config/`), and plain.
- **`callSites` extraction for Python and Go.** "Who calls `foo()`?" now works on Python and Go repos.
- **Workspace-aware `outdated`.** Per-package result entries; `--package <name>` flag (CLI) and `package` arg (MCP) to scope.
- **Workspace-aware unused-dependency check.** Each manifest is checked against imports under that package's directory.
- **Semantic-search discoverability hint.** `projscan search` prints a one-line tip on stderr when the optional semantic peer is missing.

### Removed

- **Telemetry subsystem.** `projscan_telemetry`, `projscan telemetry`, the `.projscanrc` `telemetry` block, and the `PROJSCAN_TELEMETRY` env override are gone. The opt-in local JSONL writer was paying maintenance cost without an aggregation pipeline behind it.
  - **Migration**: nothing required if telemetry was off (the default). If enabled, the config key is now silently ignored. Delete any accumulated JSONL events at `~/.projscan/telemetry.jsonl` to reclaim the space.

### Changed

- MCP tool count: 17 → 16 (dropped `projscan_telemetry`).
- Languages with full AST: 4 → 6 (Java, Ruby added).

## [0.11.0] — 2026-04-25

### Added

- **AST-derived cyclomatic complexity** for JS/TS and Python. Per-file CC is persisted in the code graph and the index cache. Counted decision points: `if`, `else if`/`elif`, `for`/`for-in`/`for-of`, `while`/`do-while`, `case` (default does not count), `catch`/`except`, `?:`, `&&`/`||`/`??`, `and`/`or`, comprehension `if`. Optional chaining and `else` do not count.
- **CC replaces LOC in the hotspot risk score.** Files outside the language-adapter set keep the LOC fallback so behavior degrades gracefully.
- **`projscan_coupling` MCP tool + `projscan coupling` CLI.** Per-file fan-in / fan-out / instability (Bob Martin's I = Ce / (Ca + Ce)) and circular-import cycles (iterative Tarjan SCC, size ≥ 2). Filters: `--cycles-only`, `--high-fan-in`, `--high-fan-out`, `--file <path>`. Cross-package edges surface in monorepos.
- **`projscan_pr_diff` MCP tool + `projscan pr-diff` CLI.** Structural diff between two refs. Per file: added / removed / modified plus explicit lists of exports added/removed, imports added/removed, call sites added/removed, ΔCC, Δfan-in. Greedy similarity-based rename detection on exports.
- **Monorepo workspace detection.** Handles npm/yarn workspaces, pnpm (`pnpm-workspace.yaml`), Lerna, modern and legacy Nx, and a `packages/*` + `apps/*` + `libs/*` fallback. Turbo is treated as a marker on top of npm/yarn/pnpm.
- **`projscan_workspaces` MCP tool + `projscan workspaces` CLI.** Lists every package (name, relative path, version, root flag).
- **`--package <name>` flag** on `hotspots`, `coupling`, `analyze`, `doctor`, `structure`, `coverage`, `search`, and `pr-diff` (CLI flag and MCP `package` arg). Scopes results to a single workspace.
- **Go as a first-class language.** AST analysis for `.go` files via tree-sitter-go. Single-line and parenthesized import blocks including aliased forms. Go's mechanical export rule (leading uppercase Unicode letter) for `func`, `method`, `var`, `const`, plus struct/interface/type. `go.mod` provides the module path; matching imports resolve into the repo, everything else is external.

### Changed

- MCP tool count: 13 → 17.
- Cache bumped to v3; old caches discarded on first 0.11 run.

### Migration note on hotspot scores

CC is much smaller than LOC for the same file (a 200-line file might have CC of 10–20 vs LOC of 200). Absolute hotspot scores will drop for adapter-parsed files (JS/TS, Python, Go), even though *rankings* improve. If your CI uses a hard threshold against `riskScore`, recalibrate it after the first 0.11 run.

## [0.10.0] — 2026-04-24

Theme: **"Beyond JS"** — Python is now a first-class language. The import graph, code search, hotspot analysis, dead-code detection, and MCP tools all work on Python repos.

### Added

- **`LanguageAdapter` interface.** Abstraction that lets every core primitive (parse, resolve imports, detect packages) be implemented per-language. The existing Babel-based code is wrapped as the `javascript` adapter; the new tree-sitter-based Python implementation is the `python` adapter. Third parties can add new languages by implementing the interface and calling `registerAdapter`.
- **Python parser via tree-sitter.** `web-tree-sitter` 0.26.8 runtime plus `tree-sitter-python` 0.25.0 grammar. Both wasm artifacts are vendored at build time; zero network at runtime.
- **Python imports / exports / resolver.** Captures `import`, `from ... import`, relative imports (`from .`, `from ..mod`), aliased imports, `from x import *`, conditional imports inside `try/except ImportError`. `__future__` imports are filtered. Honors `__all__` as the authoritative export allowlist when declared as a literal list/tuple.
- **Python package-root detection.** Reads `pyproject.toml` (PEP 621, Poetry, setuptools), `setup.py`, `setup.cfg`, `requirements*.txt`. Falls back to `__init__.py` placement, then the repo root.
- **Four new Python analyzers.** `pythonTestCheck` (pytest / unittest / nose / ward), `pythonLinterCheck` (ruff / flake8 / pylint and black / ruff-format / autopep8 / yapf), `pythonDependencyRiskCheck` (deprecated, soft-deprecated, heavy, unpinned, missing-lockfile), `pythonUnusedDependencyCheck` (with PEP 503 name normalization).
- **Default ignore list extended** for Python noise: `venv/`, `.venv/`, `env/`, `__pycache__/`, `.tox/`, `.pytest_cache/`, `.mypy_cache/`, `.ruff_cache/`, `.eggs/`, `*.egg-info/`.

### Changed

- `deadCodeCheck` rewritten language-agnostic. `__init__.py` is treated as a barrel equivalent (like `index.ts`); pytest test-file conventions are skipped.
- `codeGraph` resolution order flipped to local-first. Every adapter's `resolveImport` gets a shot at local resolution before the specifier is classified as a third-party package.

## [0.9.2] — 2026-04-20

### Security

Fixes a **path traversal / arbitrary file read** in the `projscan_upgrade` MCP tool.

**Severity: HIGH.** Users who expose `projscan mcp` to an AI agent that processes untrusted content should upgrade.

**What was wrong.** The `package` argument to `projscan_upgrade` was forwarded to `previewUpgrade` without validation. The implementation called `path.join(rootPath, 'node_modules', name, ...)` which normalizes `..` segments. A name like `../../../other-project` escaped `node_modules/` and caused the tool to return the contents of an arbitrary `CHANGELOG.md` / `History.md` file plus the `version` from any `package.json` in the traversed directory.

**Exploit model.** An AI agent using projscan over MCP processes untrusted content (README, issue body, web page) that contains a prompt-injection payload instructing it to call `projscan_upgrade` with an attacker-chosen `package` argument. Without the fix, the returned `changelogExcerpt` exfiltrates files outside the project root.

**Fix (defense in depth).**

1. `isValidPackageName(name)` rejects anything not matching the npm package-name grammar: `^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$`. Rejects `..`, `/` (except the single scope separator), `\`, whitespace, null bytes, absolute paths, and overlong names.
2. Even if a future regression let a bad name through, `readInstalledVersion` and `readChangelog` now resolve the target against `node_modules/` and refuse any path that escapes it.

**Scope.** Only `previewUpgrade` (and the `projscan_upgrade` MCP tool / CLI) was affected. Other MCP tools (`projscan_file`, `projscan_explain`) already enforced root containment.

`isValidPackageName` is exported for downstream users who want the same check.

## [0.9.1] — 2026-04-20

### Changed

- Removed em dashes from all public-facing surfaces (documentation, `package.json` description, CLI banner/help, MCP prompt text). Replaced with hyphens, colons, or periods depending on context.

## [0.9.0] — 2026-04-20

Theme: **"True Semantic Search (opt-in)"** — embeddings-based search via an optional peer dependency. Default install stays small.

### Added

- **`@xenova/transformers` declared as an optional peer dependency.** Default installs are unaffected; users who want semantic search opt in.
- **File-level embeddings** via `Xenova/all-MiniLM-L6-v2` (384-dim, quantized, ~25 MB). Disk cache at `.projscan-cache/embeddings.bin` keyed by model + mtime + content hash; invalidates on any change.
- **`projscan_search` gains a `mode` argument:** `lexical` (default, BM25 only — no peer needed), `semantic` (embeddings only — requires peer), `hybrid` (BM25 + semantic via Reciprocal Rank Fusion).
- **CLI: `projscan search --mode <m>`** and the `--semantic` shortcut.

### Fixed

- **Progress emitter context could leak between concurrent tool calls.** Previous implementation stored the current emitter on a module-level variable; under MCP pipelining, call A's progress events would route to call B's client. Rewrote using `AsyncLocalStorage` so every `withProgress` call gets an isolated context.

### Migration

If you just want the CLI, do nothing — `projscan` still works end to end.

If you want semantic search:

```bash
npm install @xenova/transformers
projscan search "which file implements auth" --mode semantic
```

The first run downloads the model (~25 MB) into the local HuggingFace cache. All queries stay offline after that.

## [0.8.0] — 2026-04-20

Theme: **"Streaming & Pagination"** — MCP agents can now consume large responses incrementally.

### Added

- **MCP protocol 2025-03-26** with version negotiation. Clients on 2024-11-05 still work — the server echoes their version when supported.
- **Cursor-based pagination** on list-returning MCP tools: `projscan_hotspots`, `projscan_search`, `projscan_audit`, `projscan_outdated`, `projscan_coverage`. Accept `cursor` + `page_size`; return `nextCursor` when more results exist.
- **Progress notifications (`notifications/progress`)** during long-running tools. Agents that set `_meta.progressToken` on the request get per-milestone updates.
- **Opt-in response chunking.** When the caller sets `stream: true`, tool output is split into multiple MCP `content` blocks. Default behavior unchanged.
- **`createMcpServer` gains a `notify` option** for transports that want to emit out-of-band JSON-RPC notifications.

### Fixed

- **`--changed-only` silently dropped issues without file locations.** Now emits a stderr message: `"N issue(s) filtered out; X had no file location"`.
- **Hotspot substring fallback had incomplete path-boundary chars.** Added `.`, `?`, `!`, `>`, `<` so cases like *"see src/a.ts."* (sentence end) correctly link to `src/a.ts`.

## [0.7.0] — 2026-04-20

Theme: **"Smart Search"** — ranked local search across content, symbols, and paths. No embeddings, no API calls.

### Added

- **BM25-ranked inverted index** over source files. Indexes content, exported symbol names, and path tokens separately, each with its own weight.
- **Query expansion.** camelCase / snake_case / digit splitting, light stemming (strip trailing `-s` / `-ing` / `-ed`), stopword + keyword filtering. `userAuthToken` indexes as `user`, `auth`, `token`.
- **Symbol-match boost.** Files that export a name matching the query rank higher than files that merely mention it.
- **`projscan_search` gains the `auto` scope** (default, BM25-ranked content + excerpt) joining the existing `symbols` / `files` / `content` scopes.
- **`projscan search <query>` CLI command.** Supports `--scope`, `--limit`, and all output formats.

### Fixed

- **MCP budget sidecar corrupted array responses.** When a handler returned an array and the budget truncated it, the server spread the array into `{ ...value, _budget }` — producing `{ "0": …, "1": …, _budget }` garbage. Now wraps non-object values as `{ value, _budget }`.
- **Hotspot ↔ issue linking used fragile substring matching.** Issues about `src/ab.ts` could falsely attach to `src/a.ts`. Now prefers `issue.locations` when present.

## [0.6.0] — 2026-04-20

Theme: **"Agent-First"** — projscan repositions as an MCP-native code-intelligence tool. The CLI still works identically.

### Added

- **Real AST parsing via `@babel/parser`** — replaces regex in `fileInspector`. Handles JS/TS/JSX/MJS/CTS with decorator, dynamic-import, top-level-await, and error-recovery support.
- **Code graph primitive.** Files + exports + imports + call sites with bidirectional edges, built from real ASTs. Relative-import resolution covers extension inference, barrel files (`foo/index.ts`), and `.js` specifiers that resolve to `.ts` under NodeNext.
- **Incremental index cache.** mtime-keyed parse cache at `.projscan-cache/graph.json` (auto-gitignored). First run populates; subsequent runs re-parse only changed files.
- **MCP context-token budgeter.** Every MCP tool call accepts an optional `max_tokens` argument. Over-budget responses are truncated record-by-record with a `_budget` sidecar.
- **`projscan_graph` MCP tool.** Query the code graph directly. Directions: `imports`, `exports`, `importers`, `symbol_defs`, `package_importers`.
- **`projscan_search` MCP tool.** Fast structural search. Scopes: `symbols` (exports), `files` (path substring), `content` (source substring with line + excerpt).

### Changed

- `buildImportGraph` is now backed by the AST-based `buildCodeGraph` internally. API unchanged; accuracy improves.
- Two new runtime dependencies: `@babel/parser` and `@babel/types`.

### Fixed (from the AST migration)

- `import type { X }` now captured everywhere. Was silently dropped by the old regex.
- Dynamic `import('./lazy.js')` now captured.
- `export * as ns from './foo.js'` and other re-export shapes now captured.

## [0.5.0] — 2026-04-20

Theme: **"Deeper Signal"**

### Added

- **`projscan coverage` command.** Parses test coverage from `coverage/lcov.info`, `coverage/coverage-final.json`, or `coverage/coverage-summary.json`. Joins coverage with the hotspot ranking to surface the **scariest untested files**: high-risk × low-coverage. Works with Vitest, Jest, c8, Istanbul.
- **Coverage-weighted hotspot risk.** Uncovered churning files bubble up the ranking; fully covered files see no change.
- **Dead-code analyzer.** Builds the full import graph; flags non-barrel / non-test source files whose exports nothing imports. Respects `package.json#main`, `#exports`, `#bin`, `#types`.
- **`projscan_coverage` MCP tool.**

### Fixed

- **`extractImports` regex was missing type-only imports** (`import type { X } from './foo.js'`), dynamic imports, and re-export shapes (`export { x } from ...`, `export * as y from ...`). Now handled.

## [0.4.0] — 2026-04-20

Theme: **"Dependency Health"**

### Added

- **`projscan outdated`.** Offline outdated check. Compares declared versions in `package.json` against versions installed under `node_modules/` and classifies drift (patch / minor / major / same / unknown). No network calls.
- **`projscan audit`.** Runs `npm audit --json` and normalizes the output into a projscan-shaped report. SARIF output routes findings into GitHub Code Scanning. Graceful messages for yarn/pnpm projects.
- **`projscan upgrade <pkg>`.** Preview the impact of upgrading a package, fully offline. Reports semver drift, extracts the relevant CHANGELOG section from `node_modules/<pkg>/`, highlights breaking-change markers (`BREAKING CHANGE`, `deprecated`, `removed support`), and lists every file that imports the package.
- **Unused-dependency analyzer.** Builds an import graph (ES imports + CommonJS requires); diffs against declared dependencies; emits `unused-dependency-<name>` issues anchored to the exact line in `package.json`. Implicit-use allowlist for typescript, eslint/prettier/vite plugins, types packages, and packages invoked via `package.json` scripts.
- **`package.json` line-level locations** on every dependency-related issue. SARIF upload to GitHub Code Scanning annotates the offending dependency line directly in PR review.
- Three new MCP tools: `projscan_outdated`, `projscan_audit`, `projscan_upgrade`.

## [0.3.1] — 2026-04-20

### Changed

- Documentation pass for 0.3.0 features (hotspots, file, mcp, SARIF output, `.projscanrc` config, `--changed-only`).
- CLI banner and help text refreshed.

## [0.3.0] — 2026-04-20

### Added

- **SARIF output (`--format sarif`)** for `analyze`, `doctor`, and `ci`. Feeds directly into GitHub Code Scanning, so projscan findings show up in the Security tab as annotated results with file/line locations.
- **`--changed-only` mode.** Restricts `analyze`, `doctor`, and `ci` to issues in files changed vs. a base ref. `--base-ref <ref>` overrides the default (auto-detects `origin/main` → `origin/master` → `main` → `master` → `HEAD~1`). Makes PR CI runs ~10× faster.
- **`.projscanrc` config.** Loads project-wide defaults from `.projscanrc.json`, `.projscanrc`, or a `"projscan"` key in `package.json`. Supports:
  - `minScore` — default threshold for `ci`.
  - `baseRef` — default base ref for `--changed-only`.
  - `hotspots.limit`, `hotspots.since` — defaults for `hotspots`.
  - `ignore` — extra glob patterns layered onto the built-in ignore list.
  - `disableRules` — silence rules by id (supports `rule-id` or wildcard `prefix-*`).
  - `severityOverrides` — remap a rule's severity (`info` / `warning` / `error`).

  CLI flags always win over config; use `--config <path>` to load a specific file.
- **First-party GitHub Action (`action.yml`).** Composite action that installs projscan, runs `projscan ci --format sarif` (optionally `--changed-only`), uploads SARIF to GitHub Code Scanning, and exposes `score` / `grade` outputs plus a Job Summary.
- **Issue locations.** `Issue` carries optional `locations: IssueLocation[]` (file, line, column). Security checks populate real file/line locations (including line numbers for hardcoded secrets).

### Changed

- `scanRepository(rootPath, { ignore })` accepts optional ignore globs that layer onto the built-in list.
- `projscan ci` no longer hard-codes `--min-score 70`; missing flag falls back to `config.minScore`, then to 70.

## [0.2.0] — 2026-04-19

### Added

- **`projscan hotspots`.** Ranks files by risk using `git log` churn × complexity (lines of code) × open issues × recency. Turns a flat health score into a prioritized "fix these first" list. Graceful fallback when the project is not a git repository.
- **`projscan file <path>`.** Per-file drill-down combining purpose, imports, exports, hotspot risk data, ownership, and the health issues that reference it.
- **`projscan mcp`.** Runs projscan as an MCP server over stdio. Exposes 7 tools (`projscan_analyze`, `projscan_doctor`, `projscan_hotspots`, `projscan_file`, `projscan_explain`, `projscan_structure`, `projscan_dependencies`), 2 prompts (`prioritize_refactoring`, `investigate_file`), and 3 resources (`projscan://health`, `projscan://hotspots`, `projscan://structure`).
- **Ownership / bus-factor analysis** on hotspots. `primaryAuthor`, `primaryAuthorShare`, `topAuthors`, and a `busFactorOne` flag (single-author + high churn ⇒ organizational risk).
- **Hotspot trend tracking.** `.projscan-baseline.json` snapshots top hotspots; `projscan diff` reports hotspots that *rose*, *fell*, *appeared*, or were *resolved* since the baseline.

### Changed

- `projscan diff --save-baseline` now captures a hotspot snapshot, enabling trend analysis on subsequent diffs.

## [0.1.3] — 2026-03-11

### Added

- **Health scoring.** Every `projscan doctor` run shows an A/B/C/D/F grade (0–100 score).
- **`projscan badge`.** Generates shields.io badge URL and markdown for READMEs.
- Score integrated into all output formats (console, JSON, markdown).

## [0.1.0] — 2026-03-11

Initial release.

- `projscan analyze` — full project analysis (languages, frameworks, dependencies, issues).
- `projscan doctor` — project health check with actionable recommendations.
- `projscan fix` — auto-fix for missing ESLint, Prettier, Vitest, and `.editorconfig`.
- `projscan explain <file>` — file-level explanation (purpose, imports, exports).
- `projscan diagram` — ASCII architecture diagram.
- `projscan structure` — directory tree visualization.
- `projscan dependencies` — dependency audit and risk analysis.
- Output formats: console, JSON, markdown.
- Detection for 30+ languages and 15+ frameworks.
