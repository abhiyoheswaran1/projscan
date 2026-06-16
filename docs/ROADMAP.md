# ProjScan Roadmap

Last reviewed 2026-06-16.

---

## Vision

**The shared code-intelligence substrate that AI coding agents stand on.**

Every agent — Claude Code, Cursor, Codex, Continue, custom orchestrations — needs the same things from the codebase it's editing: structural awareness, change-impact analysis, health signals, fix guidance. None of them want to build that themselves. projscan is the open, offline, agent-native MCP server that gives every agent the same accurate view, so they can spend their context and inference budget on the actual reasoning, not on grepping the repo.

## Stable since 1.0

projscan 1.0 shipped 2026-05-04. The stability contract is in force: MCP tool names and input schemas, CLI command names and documented flags, exit codes, and JSON output keys are under semver protection. Breaking any of them requires a 2.0 with a deprecation cycle.

## Strategic context

Three forces define the next 12 months for projscan:

1. **MCP is the de-facto standard.** The ecosystem has 10,000+ public servers; Claude Code, Cursor, Continue, Windsurf, and Codex all consume MCP. The protocol war is over; the value migrates to the _quality_ of individual servers. Code-intelligence is one of the highest-value categories.
2. **Multi-agent orchestration is the dominant 2026 pattern.** Claude Agent Teams, swarms, sub-agents. The new pain point is _coordination_: agents have separate context windows and need a shared source-of-truth about the codebase. projscan's graph + cache + budget-aware tools are uniquely positioned to be that shared substrate.
3. **Context-window cost compounds.** Token spend per turn is no longer the bottleneck — it's the _accumulated_ cost of carrying tool results, AST excerpts, and prior turns through every inference call. Agents that retrieve narrowly and budget aggressively win. projscan's `max_tokens`-aware response shaping, cursor pagination, and per-function chunking are exactly the primitives this trend rewards.

## The competitive picture

| Tool                       | Position                                 | What they do well                                                         | What we beat them on                                                                                                                                                   |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Code Pathfinder**        | Direct competitor (MCP code-intel)       | Deep static analysis: AST + CFG + DFG, dataflow tracking, security focus. | Language coverage (9 vs 1: Python). Composed agent tools (review / fix-suggest / impact / watch). Health signals (churn × CC, hotspots). Monorepo workspace awareness. |
| **Sourcegraph Cody / Amp** | Enterprise paid tier                     | Cross-repo indexing at org scale. Polished editor integrations.           | Fully offline. Open source. No SaaS dependency. Free for everyone.                                                                                                     |
| **Continue.dev**           | Configurable RAG + MCP client            | Highly extensible context providers. Local-first.                         | We're a _server_, not a client; we feed Continue (and every other MCP client). Different category.                                                                     |
| **Aider**                  | Terminal-native pair programmer          | Tight Git integration, conversational refactor flow.                      | Different category — we're not a coding agent; we're what coding agents stand on.                                                                                      |
| **GitHub MCP server**      | Adjacent (repo metadata, not code intel) | Issues / PRs / Actions surface.                                           | We do code structure; they do collaboration metadata. Complementary, not competing.                                                                                    |

**Where we're vulnerable:** Code Pathfinder has deeper analysis (CFG, DFG) and a security-finding focus. If they ship a JavaScript or TypeScript adapter, our breadth lead narrows.

**Where we lead:** breadth (11 languages), agent-native composition (one-call review, fix-suggest, impact), monorepo support, the 1.0 stability contract, and a cleaner agent-journey product story (diagnose → review → fix → reach → live).

## Strategy

Four plays, in order:

1. **Defend the lead** — close the obvious gaps so users picking an MCP server for code intel have one less reason to go elsewhere. ✅ Largely complete (1.1–1.3).
2. **Lean into multi-agent** — make projscan the _shared substrate_ for agent swarms. This is where the market is moving and where our context-budget design pays off. ✅ Largely shipped (1.4 Session, 1.5 Budgeted by default + Project Memory).
3. **Become the operator, not the advisor** — stop suggesting and start acting (cross-repo, apply, security gate). ✅ Shipped in the 1.6 arc.
4. **Expand the moat** — depth where it matters (CFG / dataflow on hot paths, more languages, sub-file embeddings, cost analytics, live PR review, plugin extensibility). Not everywhere; we're not trying to be Cody. ✅ The 1.7 → 2.0 arc turns this into a platform contract.
5. **Coordinate the swarm** — collision detection, claims/leases, merge-risk preflight, intent routing, one-call coordination, and live coordinate watch shipped across the 3.6 through 3.7 arc, with the 4.0 tool-surface consolidation now complete. The next work is evidence: prove which commands agents reach for in real multi-worktree sessions, then deepen only the paths that prevent integration failures.
6. **Make agent proof release-ready** — 4.1 through 4.5 turned Mission Control into a goal → mission → proof → review harness and packaged the post-4.4 implementation train: current planning surfaces, adoption examples, precise framework dataflow, scoped/redacted evidence exports, Python upgrade previews, and hotspot maintainability cleanup.

We are _not_ trying to be:

- A coding agent (we're what agents call into).
- A SaaS / dashboard product.
- A general-purpose static analyzer competing with SonarQube / Semgrep / Snyk.
- A linting / formatting tool.

## Now / Next / Later

### Now — Post-4.5 Validation

4.5.0 "Review-Ready Intelligence Train" packages the post-4.4 implementation train. The next work is validation and selective hardening from real use, not another broad feature push.

The active validation lines are:

- **Swarm coordination evidence.** Validate how real agents use `collisions`, `claim`, `merge-risk`, `coordinate`, and `coordinate --watch`; deepen only the coordination paths that prevent integration failures.
- **Evidence export adoption.** Prove scoped/redacted report controls work for partner, security, and release-review handoffs without leaking unnecessary repo structure.
- **Python upgrade coverage.** Extend lockfile support only after Poetry and pinned-requirement evidence prove useful in real repos.
- **Framework dataflow precision.** Add more framework patterns only when each has a narrow request source, sink, and false-positive fixture.
- **Hotspot maintainability.** Continue extracting and covering high-churn start/review/type surfaces when they show concrete review or defect risk.

Strictly **local-first** throughout: same-repo / same-machine evidence, no daemon, no cloud, no hidden network calls, no new telemetry, and no secret-value reads.

Success signals: teams copy the adoption examples into real reviews, scoped/redacted artifacts are accepted by reviewers, Python upgrade previews identify useful local evidence, dataflow additions stay quiet on lookalikes, and release bug-hunts remain free of concrete defects.

### Recently Completed — 4.5.0 (2026)

**4.5.0 "Review-Ready Intelligence Train"** shipped the post-4.4 implementation train:

- Roadmap and release-train planning now default to the current post-4.4 product lines instead of stale shipped work.
- Adoption examples cover agent orchestration, package ownership, custom policy plugins, swarm coordination, and scoped evidence exports.
- `analyze`, `doctor`, and `ci` can scope and redact shareable evidence with direct flags or named `reportPolicies` presets.
- `projscan upgrade` and MCP `projscan_upgrade` support offline Python previews from manifests, Poetry/Pipfile/uv/PDM/Conda lockfiles, pinned requirements/constraints, and Python importers.
- Dataflow detects narrow Fastify and Koa request-source patterns, including Fastify raw URL/header evidence, while suppressing lookalike helpers and Koa response-body writes.
- Start next-action assembly and taint function identity were tightened during release readiness cleanup.

### Recently Completed — 4.4.0 (2026)

**4.4.0 "Agent Release Harness"** turned Mission Control into a release-ready agent harness:

- Repo-local AgentLoopKit and AgentFlight harness commands are surfaced as proof hints when harness files exist.
- Product-planning intents route to verifiable bug-hunt/action planning instead of generic orientation.
- Bug-hunt, release-train, evidence-pack, and review wording distinguish concrete fix targets from manual release sign-off actions.
- Public type contracts are split into focused modules with a dedicated `typecheck:public-types` gate.
- Same-SHA dirty-worktree review and directory-only verification guidance were fixed.
- The dev dependency chain cleared the release audit gate without adding runtime dependencies.

### Recently Completed — 4.0.0 through 4.3.1 (2026)

- **4.0.0 "Surface Consolidation"** removed the deprecated MCP tools `projscan_explain` and `projscan_graph` after a documented deprecation cycle. CLI commands were not removed. `projscan_file` and `projscan_semantic_graph` query mode are the replacements.
- **4.1.0 through 4.2.0 "Mission Control Handoffs"** added execution plans, cursors, runbooks, task cards, review gates, shortcut commands, and saved mission bundles.
- **4.3.0 "Mission Outcome Loop"** added `projscan start --mission <dir>` and Mission Proof outcome summaries.
- **4.3.1 "Mission Proof Polish"** added Markdown proof reports, saved proof output, newest/all-bundle selection, attention filters, one-line CI summaries, and reproducible demo media.

### Recently Completed — 3.6.0 and 3.7.x Coordination (2026)

The **Swarm Coordination arc** turned projscan into the local-first coordination substrate for parallel agents working one repo across git worktrees:

- `projscan collisions` / `projscan_collision` — same-file and dependency overlaps across in-flight worktrees, surfaced before branches merge.
- `projscan claim` / `projscan_claim` — advisory claims/leases over files, dirs, or symbols, shared across worktrees, with `--ttl` expiry, contention warnings, and `prune`.
- `projscan merge-risk` / `projscan_merge_risk` — safe integration order plus conflict hotspots.
- `projscan route` / `projscan_route` — deterministic goal-to-tool routing.
- `projscan coordinate` / `projscan_coordinate` — one-call readiness verdict over collisions, claims, and merge risk.
- `projscan coordinate --watch` / `projscan_coordinate_watch` — local polling with MCP coordination-change notifications.

### Recently Completed — 3.5.0 (2026)

**3.5.0 "Plugin Trust"** hardened the two surfaces that touch untrusted repositories:

- `projscan fix` installs dev tooling with `npm install --ignore-scripts` (no shell), so applying a fix in an untrusted repo can no longer run that repo's npm lifecycle scripts.
- Local plugins require trust-on-first-use: a plugin module only executes after its exact bytes are approved with `projscan plugin trust`, and a changed module reverts to untrusted. New `plugin trust` / `untrust` commands; per-plugin trust status in `plugin list` and MCP `projscan_plugin` — approving is a deliberate CLI action and is never exposed to agents.

### Recently Completed — 3.4.0 (2026)

**3.4.0 "Repo Understanding"** gives real engineering teams a cited orientation layer before edits begin:

- `projscan understand` and MCP `projscan_understand` expose `map`, `flow`, `contracts`, `change`, and `verify` views from one stable report shape.
- Repo maps identify entrypoints, boundaries, read-first files, cited claims, unknowns, risks, and next commands.
- Flow maps trace runtime paths and side-effect sinks with graph/dataflow-backed citations.
- Contract maps summarize public exports, config/env contracts, and likely breaking-change risks.
- Change-readiness output connects an optional intent to blast radius, first safe edit, owner state, rollback, and verification commands.
- Verification maps separate minimal, focused, and full proof tiers while surfacing source files without direct filename-matched tests.

### Recently Completed — 3.3.0 (2026)

**3.3.0 "Roadmap Evidence Polish"** made the planned roadmap surfaces concrete across adoption proof, reviewer evidence, onboarding, dataflow precision, plugin authoring, and multi-agent coordination:

- Dogfood and trial reports expose proof gates plus `marketValidation.nextProofStep` before adoption claims are treated as proven.
- PR evidence comments include `### Reviewer Decision` with decision, reason, owner state, and first command; generated GitHub Action validation now requires that section.
- `projscan start` includes top-level `coordinationHints`, and human console output shows the full first-ten-minutes path plus coordination follow-up commands.
- Hono route-context request reads such as `c.req.json()` are detected as framework request sources while ordinary Hono-shaped helpers stay quiet.
- `projscan plugin test --format json` returns trust, commands, execution, and graph/dataflow context guidance for local plugin authors while staying static unless `--execute` and `PROJSCAN_PLUGINS_PREVIEW=1` are both present.
- PR comment rendering and validation moved into a focused evidence-comment helper while preserving existing public exports.

### Recently Completed — 3.1.0 (2026)

**3.1.0 "Trust Boundary Hardening"** made the local-first trust boundary visible and enforceable before broader adoption:

- `projscan privacy-check` reports telemetry status, offline mode, scan root, Git ignore handling, ignored-file count, `.env` content scanning, plugin execution, local write surfaces, report export sensitivity, and known network-capable endpoints.
- Scans respect Git's visible-file boundary by default: tracked files plus untracked non-ignored files. Ignored files require explicit opt-in with `--include-ignored` or `scan.includeIgnored: true`.
- `.env*` files are path-only by default. Tracked environment files can be flagged by filename without reading values unless `--scan-env-values` or `scan.scanEnvValues: true` is enabled.
- `--offline`, `PROJSCAN_OFFLINE=1`, and `scan.offline: true` block known network-capable features across telemetry, npm audit, registry checks, and optional semantic model loading.
- `projscan start` and `projscan preflight` separate current Git/worktree evidence from remembered session context so old agent-session touches do not look like current risk.
- `npm run test:trust-smoke` gives maintainers a fast release gate for privacy, offline, MCP start/preflight/watch, Git ignore behavior, telemetry, and secret-scanning defaults.

### Recently Completed — 3.0.9 to 3.0.5 (2026)

**3.0.9 "Opt-in Product Telemetry"** added transparent default-off telemetry controls for anonymous product-health metrics without source code, paths, repo names, branch names, package names, usernames, raw findings, secrets, or environment values.

**3.0.8 "Legal and Trust Hardening"** added public legal, vulnerability-reporting, contribution, and brand-trust surfaces for open-source adoption.

**3.0.7 "Trial Adoption Report"** turned the adoption loop into measured product proof with reviewer feedback, dogfood gates, and trial verdicts.

**3.0.6 "Market Validation Loop"** added structured market-validation evidence and Baseframe Labs umbrella-brand surfaces for public marketing and vulnerability-disclosure contact.

**3.0.5 "Proof of Usefulness"** made the first successful team PR the product's hero surface with the end-to-end adoption harness, PR comment benchmarks, fix-first recommendations, baseline trend memory, and Express/Next dataflow precision.

### Later

Later work should deepen proven surfaces rather than add broad categories:

- Add stronger sub-file and symbol-level coordination once real swarm examples show which conflicts matter.
- Extend Python upgrade intelligence toward broader lockfile formats after Poetry and pinned-requirement evidence are proven useful.
- Add more framework dataflow patterns only when each has a clear request source, sink, and false-positive fixture.

## Non-goals

- **Coding agent.** We don't write code; we tell agents what's there.
- **SaaS / dashboard.** projscan is a local tool; cloud features are off the table for the 1.x line.
- **Snyk / SonarQube competition.** SAST stays minimal; if we add CFG/DFG it's narrowly targeted at agent use cases (taint tracking inside a review), not general security scanning.
- **IDE-specific extensions.** projscan is an MCP server. The CLI is for humans. No VS Code extension, no JetBrains plugin.
- **LLM-inside-projscan.** `projscan_fix_suggest` is rule-driven by design. The driving agent is the LLM; we feed it structured prompts. We will not embed an inference call.

## Risks

- **Code Pathfinder catches up on languages.** They're 1-language today (Python) but the AST + CFG infrastructure is solid. If they ship a JS/TS adapter, our breadth lead narrows. Mitigation: keep adding languages on the cadence; deepen agent-native composition.
- **Multi-agent orchestration matures faster than we can ship Session.** If Claude Agent Teams becomes the default and ships its own shared-state primitive, our 1.4 bet weakens. Mitigation: design Session as a _complement_ to Agent Teams rather than a replacement.
- **Context-cost trend reverses.** If models get cheaper and context windows grow, our budget-aware design becomes table stakes rather than a differentiator. Mitigation: that's a good problem to have; the underlying primitives still work.

## How to influence this roadmap

If you've adopted projscan and want something specific:

- **Open a GitHub issue** describing the use case. The "what an agent of mine couldn't answer" framing helps prioritize over generic feature requests.
- **For larger work** (a new MCP tool category, a refactor, a 2.0 candidate), open a discussion first so we can align on the shape before you spend a weekend on it.

---

## Recently Shipped

For the full release notes, see [CHANGELOG.md](../CHANGELOG.md).

| Version                      | Theme                     | Headline                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **3.6.0** (2026-06-05)       | Swarm Coordination        | Local-first coordination for parallel agents across git worktrees: `projscan_collision`, `projscan_claim` (leased), `projscan_merge_risk`, `projscan_route`, `projscan_coordinate`; graceful embedding degradation; 41 → 47 tools                                                                                                                                                                                                         |
| **3.5.0** (2026-06-04)       | Plugin Trust              | `projscan fix` installs with `--ignore-scripts` (no lifecycle-script RCE); local plugins gated by trust-on-first-use (`projscan plugin trust`), plus a hardened, model-degrading embedding path                                                                                                                                                                                                                                           |
| **3.4.0** (2026-06-04)       | Repo Understanding        | `projscan understand` / `projscan_understand` with cited repo, flow, contract, change-readiness, and verification maps for working engineers                                                                                                                                                                                                                                                                                              |
| **3.3.0** (2026-06-03)       | Roadmap Evidence Polish   | Adoption proof gates, reviewer decision evidence, first-ten-minutes/start coordination hints, Hono request-source precision, plugin trust guidance, generated PR-comment validation, and evidence helper extraction                                                                                                                                                                                                                       |
| **3.2.0** (2026-06-03)       | Roadmap Train             | Canonical 3.2-3.9 release train surfaced in release planning and roadmap docs                                                                                                                                                                                                                                                                                                                                                             |
| **3.1.0** (2026-06-02)       | Trust Boundary Hardening  | Privacy-check trust report, Git-visible scan boundary, path-only `.env` defaults, offline mode, session/worktree risk split, and fast trust smoke gate                                                                                                                                                                                                                                                                                    |
| **3.0.8** (2026-06-01)       | Legal and Trust Hardening | Public legal/trust documents, vulnerability reporting, contribution provenance, and canonical icon packaging                                                                                                                                                                                                                                                                                                                              |
| **3.0.7** (2026-05-31)       | Trial Adoption Report     | Adoption trial verdict, structured reviewer feedback capture, measured market-validation gates, and refreshed adoption docs                                                                                                                                                                                                                                                                                                               |
| **3.0.6** (2026-05-31)       | Market Validation Loop    | Feedback-backed dogfood evidence, minutes-saved/prevented-edit tracking, false-positive reporting, Baseframe Labs brand surfaces, and security disclosure assets                                                                                                                                                                                                                                                                          |
| **3.0.5** (2026-05-28)       | Proof of Usefulness       | End-to-end adoption harness, five-scenario PR comment benchmarks, fix-first output, richer baseline trend memory, Express/Next dataflow precision, and scale-risk calibration                                                                                                                                                                                                                                                             |
| **3.0.4** (2026-05-28)       | Team Adoption Loop        | Team bootstrap, MCP setup doctor, validated PR evidence comments, baseline trend memory, owner routing, practical plugins, and trust calibration                                                                                                                                                                                                                                                                                          |
| **3.0.3** (2026-05-27)       | Agent Review Precision    | Package-scoped review verdicts, receiver-sensitive route request sources, generated-code review/dataflow filtering, package owner fallback, and v5 GitHub Actions                                                                                                                                                                                                                                                                         |
| **3.0.2** (2026-05-27)       | Agent Graph Readiness     | Graph corpus release gates, custom dataflow visibility, remote tag integrity, CODEOWNERS impact ownership, and 3.x release-train planning                                                                                                                                                                                                                                                                                                 |
| **3.0.1** (2026-05-26)       | Graph Operations Platform | Graph-backed review/workplan/brief evidence, cross-repo boundary impact, plugin graph context, golden graph corpus, and hardened dataflow precision                                                                                                                                                                                                                                                                                       |
| **3.0.0** (2026-05-23)       | Deep Graph Platform       | Stable v3 semantic graph, dataflow risk engine, bridge-helper review blocks, 39-tool MCP surface, and public graph/dataflow APIs                                                                                                                                                                                                                                                                                                          |
| **2.9.0** (2026-05-23)       | Adoption Layer            | MCP client config snippets, workflow recipes, first-run diagnostics, adoption MCP tool, plugin gallery, and console guidance polish                                                                                                                                                                                                                                                                                                       |
| **2.8.0** (2026-05-22)       | Agent Mission Control     | Workplans, bug-hunt queues, release readiness, evidence packs, regression plans, agent briefs, and quality scorecards                                                                                                                                                                                                                                                                                                                     |
| **2.0.0** (2026-05-18)       | Plugin Platform           | Stable local analyzer/reporter plugin contract, manifest schema and tested examples, CLI JSON `schemaVersion: 2`, extensible `LanguageId`, and removal of deprecated regex import/export helpers                                                                                                                                                                                                                                          |
| **1.11.0** (2026-05-18)      | Reporter Plugins          | Reporter plugin preview for CLI output (`--reporter` on `doctor`, `analyze`, and `ci`), reporter manifest validation through `projscan_plugin`, and refreshed README media with a macOS-style terminal demo                                                                                                                                                                                                                               |
| **1.10.0** (2026-05-13)      | RC for 2.0                | Analyzer plugin API preview behind PROJSCAN_PLUGINS_PREVIEW flag (`projscan_plugin` MCP tool, `projscan plugin` CLI, `.projscan-plugins/*.projscan-plugin.json` schema); live cost-summary streaming with `notifications/projscan/cost_delta`; five 1.9-deferred fixes (applyFix rollback dir handling, incrementalUpdateGraph context staleness, changedFiles maxBuffer surfacing, taint per-step frontier cap, watcher.close mid-flush) |
| **1.9.0** (2026-05-12)       | Intent + Polish           | Intent-grounded review: free-text PR description → per-finding expected / unexpected / out-of-scope labels (no LLM); Project Memory loop #4 (per-rule severity drift, cry-wolf / noisy / stable); review_watch signature deepening with structured `delta` payload; macOS CI leg                                                                                                                                                          |
| **1.8.1** (2026-05-08)       | Docs patch                | README setup snippets for Codex CLI + Gemini CLI                                                                                                                                                                                                                                                                                                                                                                                          |
| **1.8.0** (2026-05-08)       | Resilience + Live         | Swift adapter (11 languages); long-running PR watch (`projscan_review_watch`) with `notifications/projscan/pr_changed`; atomic session save; taint truncation reporting + MAX_DEPTH 8 → 12; embeddings LRU; templated C++ qualified-id; 7 fixes from a three-way multi-agent bug hunt                                                                                                                                                     |
| **1.7.0** (2026-05-07)       | Reach + Visibility        | Kotlin and C++ adapters (10 languages); per-rule confidence in Project Memory (loop #3); aggregate cost analytics (`projscan_cost_summary`); 6 fixes from a four-way multi-agent bug hunt                                                                                                                                                                                                                                                 |
| **1.6.0** (2026-05-06)       | Operator                  | Cross-repo workspace + intelligence (`projscan_workspace_graph`); mechanical apply layer with rollback (`projscan_apply_fix`, six templates); source-to-sink taint analysis (`projscan_taint`) wired into review as a hard block on new flows                                                                                                                                                                                             |
| **1.5.0** (2026-05-05)       | Budgeted by default       | `_cost` sidecar on every result; adaptive `projscan_review` with full / summary / verdict-only tiers                                                                                                                                                                                                                                                                                                                                      |
| **1.4.0** (2026-05-05)       | Session                   | Durable cross-invocation session: `projscan_session` MCP tool, auto-touched files, event log                                                                                                                                                                                                                                                                                                                                              |
| **1.3.0** (2026-05-05)       | Push, Don't Poll          | MCP `notifications/file_changed` push and registry-aware upgrade preview                                                                                                                                                                                                                                                                                                                                                                  |
| **1.2.1** (2026-05-05)       | Animated docs             | Animated GIFs replace static command screenshots                                                                                                                                                                                                                                                                                                                                                                                          |
| **1.2.0** (2026-05-05)       | Reporter Parity           | PHP and C# adapters, HTML reporters, per-function fan-out                                                                                                                                                                                                                                                                                                                                                                                 |
| **1.1.1** (2026-05-04)       | Dogfood patch             | Tree-sitter false-positive fix                                                                                                                                                                                                                                                                                                                                                                                                            |
| **1.1.0** (2026-05-04)       | On the Map                | Rust adapter and fix-suggest templates for `eslint-*` and `python-type-error-*`                                                                                                                                                                                                                                                                                                                                                           |
| **1.0.0** (2026-05-04)       | Stable                    | Public no-break commitment release                                                                                                                                                                                                                                                                                                                                                                                                        |
| **0.17.0** (2026-05-02)      | RC + Docs                 | Documentation reorganized around the agent journey                                                                                                                                                                                                                                                                                                                                                                                        |
| **0.16.0** (2026-04-30)      | Live                      | `projscan watch` CLI and HTML report export                                                                                                                                                                                                                                                                                                                                                                                               |
| **0.15.0** (2026-04-27)      | Reach                     | `projscan_impact` blast-radius tool, per-function fan-in, sub-file embeddings                                                                                                                                                                                                                                                                                                                                                             |
| **0.14.0** (2026-04-26)      | Agent Fix Loop            | `projscan_fix_suggest` and `projscan_explain_issue`                                                                                                                                                                                                                                                                                                                                                                                       |
| **0.13.0** (2026-04-26)      | Agent Review              | `projscan_review` one-call PR review and per-function cyclomatic complexity                                                                                                                                                                                                                                                                                                                                                               |
| **0.12.0** (2026-04-25)      | —                         | Java and Ruby adapters, workspace-aware `outdated` and unused-dep                                                                                                                                                                                                                                                                                                                                                                         |
| **0.11.0** (2026-04-25)      | —                         | AST cyclomatic complexity, `projscan_coupling`, `projscan_pr_diff`, monorepo workspace detection, Go adapter                                                                                                                                                                                                                                                                                                                              |
| **0.10.0** (2026-04-24)      | Beyond JS                 | Python as a first-class language; `LanguageAdapter` interface                                                                                                                                                                                                                                                                                                                                                                             |
| **0.9.0–0.9.2** (2026-04-20) | True Semantic Search      | Optional `@xenova/transformers` peer; security patch for path traversal                                                                                                                                                                                                                                                                                                                                                                   |
| **0.8.0** (2026-04-20)       | Streaming & Pagination    | MCP protocol 2025-03-26, cursor pagination, progress notifications                                                                                                                                                                                                                                                                                                                                                                        |
| **0.7.0** (2026-04-20)       | Smart Search              | BM25-ranked content + symbol + path search                                                                                                                                                                                                                                                                                                                                                                                                |
| **0.6.0** (2026-04-20)       | Agent-First               | Real AST parsing, code graph primitive, incremental cache, MCP token budgeter                                                                                                                                                                                                                                                                                                                                                             |
| **0.5.0** (2026-04-20)       | Deeper Signal             | `projscan coverage`, dead-code analyzer                                                                                                                                                                                                                                                                                                                                                                                                   |
| **0.4.0** (2026-04-20)       | Dependency Health         | `projscan outdated` / `audit` / `upgrade`, unused-dependency analyzer                                                                                                                                                                                                                                                                                                                                                                     |
| **0.3.0–0.3.1** (2026-04-20) | —                         | SARIF output, `--changed-only`, `.projscanrc` config, GitHub Action                                                                                                                                                                                                                                                                                                                                                                       |
| **0.2.0** (2026-04-19)       | —                         | `projscan hotspots`, `projscan mcp`                                                                                                                                                                                                                                                                                                                                                                                                       |
| **0.1.x** (2026-03-11)       | —                         | Initial release: analyze, doctor, fix, explain, diagram, structure, dependencies, badge                                                                                                                                                                                                                                                                                                                                                   |
