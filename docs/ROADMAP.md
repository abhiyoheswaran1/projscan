# ProjScan Roadmap

Last reviewed 2026-05-05.

---

## Vision

**The shared code-intelligence substrate that AI coding agents stand on.**

Every agent — Claude Code, Cursor, Codex, Continue, custom orchestrations — needs the same things from the codebase it's editing: structural awareness, change-impact analysis, health signals, fix guidance. None of them want to build that themselves. projscan is the open, offline, agent-native MCP server that gives every agent the same accurate view, so they can spend their context and inference budget on the actual reasoning, not on grepping the repo.

## Stable since 1.0

projscan 1.0 shipped 2026-05-04. The stability contract is in force: MCP tool names and input schemas, CLI command names and documented flags, exit codes, and JSON output keys are under semver protection. Breaking any of them requires a 2.0 with a deprecation cycle.

## Strategic context

Three forces define the next 12 months for projscan:

1. **MCP is the de-facto standard.** The ecosystem has 10,000+ public servers; Claude Code, Cursor, Continue, Windsurf, and Codex all consume MCP. The protocol war is over; the value migrates to the *quality* of individual servers. Code-intelligence is one of the highest-value categories.
2. **Multi-agent orchestration is the dominant 2026 pattern.** Claude Agent Teams, swarms, sub-agents. The new pain point is *coordination*: agents have separate context windows and need a shared source-of-truth about the codebase. projscan's graph + cache + budget-aware tools are uniquely positioned to be that shared substrate.
3. **Context-window cost compounds.** Token spend per turn is no longer the bottleneck — it's the *accumulated* cost of carrying tool results, AST excerpts, and prior turns through every inference call. Agents that retrieve narrowly and budget aggressively win. projscan's `max_tokens`-aware response shaping, cursor pagination, and per-function chunking are exactly the primitives this trend rewards.

## The competitive picture

| Tool | Position | What they do well | What we beat them on |
|---|---|---|---|
| **Code Pathfinder** | Direct competitor (MCP code-intel) | Deep static analysis: AST + CFG + DFG, dataflow tracking, security focus. | Language coverage (9 vs 1: Python). Composed agent tools (review / fix-suggest / impact / watch). Health signals (churn × CC, hotspots). Monorepo workspace awareness. |
| **Sourcegraph Cody / Amp** | Enterprise paid tier | Cross-repo indexing at org scale. Polished editor integrations. | Fully offline. Open source. No SaaS dependency. Free for everyone. |
| **Continue.dev** | Configurable RAG + MCP client | Highly extensible context providers. Local-first. | We're a *server*, not a client; we feed Continue (and every other MCP client). Different category. |
| **Aider** | Terminal-native pair programmer | Tight Git integration, conversational refactor flow. | Different category — we're not a coding agent; we're what coding agents stand on. |
| **GitHub MCP server** | Adjacent (repo metadata, not code intel) | Issues / PRs / Actions surface. | We do code structure; they do collaboration metadata. Complementary, not competing. |

**Where we're vulnerable:** Code Pathfinder has deeper analysis (CFG, DFG) and a security-finding focus. If they ship a JavaScript or TypeScript adapter, our breadth lead narrows.

**Where we lead:** breadth (9 languages), agent-native composition (one-call review, fix-suggest, impact), monorepo support, the 1.0 stability contract, and a cleaner agent-journey product story (diagnose → review → fix → reach → live).

## Strategy

Four plays, in order:

1. **Defend the lead** — close the obvious gaps so users picking an MCP server for code intel have one less reason to go elsewhere. ✅ Largely complete (1.1–1.3).
2. **Lean into multi-agent** — make projscan the *shared substrate* for agent swarms. This is where the market is moving and where our context-budget design pays off. ✅ Largely shipped (1.4 Session, 1.5 Budgeted by default + Project Memory).
3. **Become the operator, not the advisor** — stop suggesting and start acting (cross-repo, apply, security gate). **Now (1.6).**
4. **Expand the moat** — depth where it matters (CFG / dataflow on hot paths, more languages, sub-file embeddings, cost analytics, live PR review). Not everywhere; we're not trying to be Cody. **Next (1.7 → 1.10), then 2.0.**

We are *not* trying to be:
- A coding agent (we're what agents call into).
- A SaaS / dashboard product.
- A general-purpose static analyzer competing with SonarQube / Semgrep / Snyk.
- A linting / formatting tool.

## Now / Next / Later

### Now — 1.7 → 1.10 (Q4 2026 — 2027)

**Theme arc: "From advisor to operator."** 1.6 (Operator) just shipped — projscan now acts across boundaries (cross-repo), inside the codebase (apply layer), and at the security gate (taint flow). Next: breadth (mobile, C++), depth (cost analytics, live review), and the platform commitment (2.0 plugin API).

| Release | Theme | Why an agent must have this |
|---|---|---|
| **1.7.0 "Mobile"** | Kotlin and Swift adapters | Two huge codebases projscan can't see today: Android and iOS. Closing the mobile gap before competitors do. |
| **1.8.0 "Depth"** | C++ adapter + Project Memory loop #3 (per-rule confidence) + sub-file embedding refinements | C++ for systems / games / embedded. Per-rule confidence weighting auto-deprioritizes rules with low fix-rates — Project Memory's third loop, viable now that ~6 months of accumulated signal exists. |
| **1.9.0 "Cost Visibility"** | Aggregate cost analytics, per-tool cost catalog | Agents can't optimize tokens they can't see. The `_cost` sidecar (1.5) was per-call; 1.9 is the dashboard view: session totals, top spenders, pre-call cost budgets. |
| **1.10.0 "Live Reviewer"** | Long-running PR-watch mode | `projscan_review` is a snapshot. PRs are streams. Subscribe-once-watch-forever closes the long-session loop on PRs the way `--watch` (1.3) did for files. The capstone for the agent-substrate arc. |

### Later — 2.0 (2027+)

**2.0.0 "Plugin API + Breaking"** — after 1.10 the agent-substrate arc is mature. Time to commit a platform contract.

- **Plugin API.** Third parties write `.projscan-plugin.json` declaring an analyzer or reporter; projscan dispatches via a stable interface. `projscan plugin list` for discovery. Turns projscan from a tool into a substrate other tools build on.
- Remove deprecated regex extractors (`extractImports` / `extractExports`, marked `@deprecated` in 0.17).
- JSON output schema cleanups — consolidate the optional-field accumulation that grew through 0.x → 1.x.
- `LanguageId` becomes plugin-extensible (no longer a closed type).
- 1.x compatibility shim for 6 months with stderr deprecation warnings.
- HTML report theming: white-label via plugin API rather than core feature.

## Non-goals

- **Coding agent.** We don't write code; we tell agents what's there.
- **SaaS / dashboard.** projscan is a local tool; cloud features are off the table for the 1.x line.
- **Snyk / SonarQube competition.** SAST stays minimal; if we add CFG/DFG it's narrowly targeted at agent use cases (taint tracking inside a review), not general security scanning.
- **IDE-specific extensions.** projscan is an MCP server. The CLI is for humans. No VS Code extension, no JetBrains plugin.
- **LLM-inside-projscan.** `projscan_fix_suggest` is rule-driven by design. The driving agent is the LLM; we feed it structured prompts. We will not embed an inference call.

## Risks

- **Code Pathfinder catches up on languages.** They're 1-language today (Python) but the AST + CFG infrastructure is solid. If they ship a JS/TS adapter, our breadth lead narrows. Mitigation: keep adding languages on the cadence; deepen agent-native composition.
- **Multi-agent orchestration matures faster than we can ship Session.** If Claude Agent Teams becomes the default and ships its own shared-state primitive, our 1.4 bet weakens. Mitigation: design Session as a *complement* to Agent Teams rather than a replacement.
- **Context-cost trend reverses.** If models get cheaper and context windows grow, our budget-aware design becomes table stakes rather than a differentiator. Mitigation: that's a good problem to have; the underlying primitives still work.

## How to influence this roadmap

If you've adopted projscan and want something specific:

- **Open a GitHub issue** describing the use case. The "what an agent of mine couldn't answer" framing helps prioritize over generic feature requests.
- **For larger work** (a new MCP tool category, a refactor, a 2.0 candidate), open a discussion first so we can align on the shape before you spend a weekend on it.

---

## Recently Shipped

For the full release notes, see [CHANGELOG.md](../CHANGELOG.md).

| Version | Theme | Headline |
|---|---|---|
| **1.6.0** (2026-05-06) | Operator | Cross-repo workspace + intelligence (`projscan_workspace_graph`); mechanical apply layer with rollback (`projscan_apply_fix`, six templates); source-to-sink taint analysis (`projscan_taint`) wired into review as a hard block on new flows |
| **1.5.0** (2026-05-05) | Budgeted by default | `_cost` sidecar on every result; adaptive `projscan_review` with full / summary / verdict-only tiers |
| **1.4.0** (2026-05-05) | Session | Durable cross-invocation session: `projscan_session` MCP tool, auto-touched files, event log |
| **1.3.0** (2026-05-05) | Push, Don't Poll | MCP `notifications/file_changed` push and registry-aware upgrade preview |
| **1.2.1** (2026-05-05) | Animated docs | Animated GIFs replace static command screenshots |
| **1.2.0** (2026-05-05) | Reporter Parity | PHP and C# adapters, HTML reporters, per-function fan-out |
| **1.1.1** (2026-05-04) | Dogfood patch | Tree-sitter false-positive fix |
| **1.1.0** (2026-05-04) | On the Map | Rust adapter and fix-suggest templates for `eslint-*` and `python-type-error-*` |
| **1.0.0** (2026-05-04) | Stable | Public no-break commitment release |
| **0.17.0** (2026-05-02) | RC + Docs | Documentation reorganized around the agent journey |
| **0.16.0** (2026-04-30) | Live | `projscan watch` CLI and HTML report export |
| **0.15.0** (2026-04-27) | Reach | `projscan_impact` blast-radius tool, per-function fan-in, sub-file embeddings |
| **0.14.0** (2026-04-26) | Agent Fix Loop | `projscan_fix_suggest` and `projscan_explain_issue` |
| **0.13.0** (2026-04-26) | Agent Review | `projscan_review` one-call PR review and per-function cyclomatic complexity |
| **0.12.0** (2026-04-25) | — | Java and Ruby adapters, workspace-aware `outdated` and unused-dep |
| **0.11.0** (2026-04-25) | — | AST cyclomatic complexity, `projscan_coupling`, `projscan_pr_diff`, monorepo workspace detection, Go adapter |
| **0.10.0** (2026-04-24) | Beyond JS | Python as a first-class language; `LanguageAdapter` interface |
| **0.9.0–0.9.2** (2026-04-20) | True Semantic Search | Optional `@xenova/transformers` peer; security patch for path traversal |
| **0.8.0** (2026-04-20) | Streaming & Pagination | MCP protocol 2025-03-26, cursor pagination, progress notifications |
| **0.7.0** (2026-04-20) | Smart Search | BM25-ranked content + symbol + path search |
| **0.6.0** (2026-04-20) | Agent-First | Real AST parsing, code graph primitive, incremental cache, MCP token budgeter |
| **0.5.0** (2026-04-20) | Deeper Signal | `projscan coverage`, dead-code analyzer |
| **0.4.0** (2026-04-20) | Dependency Health | `projscan outdated` / `audit` / `upgrade`, unused-dependency analyzer |
| **0.3.0–0.3.1** (2026-04-20) | — | SARIF output, `--changed-only`, `.projscanrc` config, GitHub Action |
| **0.2.0** (2026-04-19) | — | `projscan hotspots`, `projscan mcp` |
| **0.1.x** (2026-03-11) | — | Initial release: analyze, doctor, fix, explain, diagram, structure, dependencies, badge |
