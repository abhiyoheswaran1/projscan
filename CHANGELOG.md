# Changelog

All notable changes to projscan are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `projscan collisions --transitive` (and MCP `projscan_collision { transitive: true }`): opt-in multi-hop dependency overlap detection — flags when one worktree changes a file another worktree's change *transitively* imports, with the `distance` (hops). The 1-hop default stays precise; `--max-distance` bounds the walk.

### Changed

- `projscan agent-brief` / `projscan_agent_brief` now surfaces a `swarm-coordination` hint when parallel worktrees are in flight — folding the collision / contended-claim / merge-order signal into the brief's `coordinationHints` so the next agent sees swarm state without a separate call. No-op for single-worktree repos.
- `projscan preflight` / `projscan_preflight` now includes a `coordination` evidence bucket and, when in-flight worktrees collide, a `coordination`-source reason — advisory only (raises `caution`, never a hard `block`). No-op for single-worktree repos, so existing verdicts are unchanged.

## [3.6.0] — 2026-06-05 — "Swarm Coordination"

### Added

- `projscan collisions` and MCP `projscan_collision`: detect change collisions across the repo's in-flight git worktrees (parallel agents). Flags same-file edits and dependency overlaps — where one worktree changes a file another worktree's change imports, via the import graph — before the branches merge. Local-first; needs at least two worktrees. First step of the 4.x agent-swarm coordination arc.
- `projscan claim` and MCP `projscan_claim`: advisory claims/leases over files, directories, or symbols, shared across the repo's git worktrees so parallel agents see who owns what. Adding a claim surfaces contention when another agent already holds an overlapping target; claims can carry a lease (`--ttl` / `ttl_seconds`) so a crashed agent's claim auto-expires, and `prune` clears expired leases. Claims list and release explicitly. Local-first.
- `projscan merge-risk` and MCP `projscan_merge_risk`: merge-risk preflight across in-flight worktrees — a safe integration order (merge the least-entangled branch first) and the files where conflict risk concentrates (changed by two or more worktrees). Builds on collision detection. Local-first.
- `projscan route` and MCP `projscan_route`: map a stated goal (e.g. "what breaks if I rename X", "coordinate parallel agents") to the right projscan tool with the exact call, or list the full capability catalog. A discovery entry point over the tool surface — deterministic keyword routing, no inference.
- `projscan coordinate` and MCP `projscan_coordinate`: one-call swarm coordination read that composes collisions, claims, and merge-risk into a `readiness` verdict (clear / caution / conflicted) with counts and the recommended integration order — the single entry point for the 4.x coordination arc.

### Fixed

- Semantic search now degrades to BM25 when the embedding model can't be loaded (offline, model-host rate limits, or a corrupt cache) instead of throwing, and a transient load failure no longer poisons the in-process model cache.

## [3.5.0] — 2026-06-04 — "Plugin Trust"

### Security

- `projscan fix` now installs dev tooling (ESLint, Prettier, Vitest) with `npm install --ignore-scripts`, so applying a fix in an untrusted repository can no longer execute that repo's `preinstall`/`postinstall`/`prepare` lifecycle scripts. The install also no longer goes through a shell.
- Local plugins now require explicit trust-on-first-use approval in addition to `PROJSCAN_PLUGINS_PREVIEW=1`: a plugin module only executes after you approve its exact bytes with `projscan plugin trust <name>`. If the module changes, it reverts to untrusted until re-approved. Untrusted plugins are still discovered and listed but never run.

### Added

- `projscan plugin trust <name>` / `projscan plugin trust --all` / `projscan plugin untrust <name>` to manage approved plugin modules. `projscan plugin list` and the MCP `projscan_plugin` list action now report a per-plugin `trust` status (`trusted` / `untrusted` / `changed`). Approving a plugin is a deliberate CLI action and is intentionally not exposed over the MCP server.

## [3.4.1] — 2026-06-04 — "Security Hardening"

### Security

- `projscan plugin test` now validates statically by default and imports/runs plugin code only when `--execute` or `--confirm-execute` is passed with `PROJSCAN_PLUGINS_PREVIEW=1` already set.
- MCP `projscan_workplan` `enable_plugins` now only requests plugin evidence when the server process already has `PROJSCAN_PLUGINS_PREVIEW=1`; preflight no longer mutates `PROJSCAN_PLUGINS_PREVIEW` internally.
- MCP `projscan_plugin validate` now rejects absolute paths, `..` traversal, and manifests outside `<root>/.projscan-plugins/` after realpath resolution.
- Cross-repo workspace graph now reads locally trusted registrations from `.projscan-cache/workspace.json`, ignores project-root `.projscan-workspace.json`, canonicalizes sibling repo paths, caps registered repos, and avoids unbounded trusted workspace graph scans.
- Upgraded Vitest to `^4.1.8` and changed the release gate to run a full dependency audit, including dev dependencies.

## [3.4.0] — 2026-06-04 — "Repo Understanding"

### Added

- Added `projscan understand`, a repo-comprehension command for working engineers that produces cited repo maps, runtime flow maps, contract maps, change-readiness guidance, and verification proof plans.
- Added MCP tool `projscan_understand` with `map`, `flow`, `contracts`, `change`, and `verify` views for agent-facing repo understanding.
- Added file/symbol-backed `claims`, `readFirst`, `entrypoints`, `boundaries`, `flows`, `contracts`, `changeReadiness`, `verification`, `risks`, `unknowns`, and exact next commands to the understand report.
- Added change-readiness output that ties an optional intent to blast radius, first safe edit, owner state, rollback command, and verification commands.
- Added verification tiers that separate minimal, focused, and full proof commands while surfacing source files without direct filename-matched tests.

### Changed

- Generated MCP tool manifest now includes 41 tools with `projscan_understand` as the repo-comprehension surface.
- Website update guidance now highlights repo understanding, cited claims, unknowns, change readiness, and verification maps as the primary 3.4.0 product story.

## [3.3.0] — 2026-06-03 — "Roadmap Evidence Polish"

### Added

- Added adoption proof gates and `marketValidation.nextProofStep` output so dogfood and trial reports identify the next missing proof step before public adoption claims.
- Added reviewer-decision evidence to generated PR comments, including decision, reason, owner state, and first command.
- Added top-level `coordinationHints` to `projscan start` output so start reports expose current-worktree checks and remembered-session follow-up commands.
- Added full first-ten-minutes and coordination-hint sections to human `projscan start` console output.
- Added generated GitHub Action validation for the `### Reviewer Decision` PR-comment section.

### Changed

- Dataflow framework-source detection recognizes Hono route-context request reads such as `c.req.json()` while preserving ordinary Hono-shaped helper false-positive guards.
- `projscan plugin test --format json` returns trust reminders, validation commands, enablement commands, and graph/dataflow context guidance for local plugin authors.
- PR comment rendering and validation now live in `src/core/evidenceComment.ts`, keeping release evidence orchestration smaller while preserving the existing public exports.

## [3.2.0] — 2026-06-03 — "Roadmap Train"

### Added

- Added the canonical 3.2.x through 3.9.x roadmap train to `projscan release-train`, covering roadmap canonicalization, adoption proof polish, PR evidence quality, first-ten-minutes UX, maintainability hardening, graph/dataflow precision, plugin ecosystem guidance, and multi-agent coordination.
- Added `firstTenMinutes` to `projscan start`, `projscan first-run`, and the adoption MCP first-run response so the first trust, orientation, preflight, MCP, evidence, feedback, and dogfood commands stay in one shared order.
- Added `marketValidation.proofGates` and `marketValidation.nextProofStep` to dogfood/trial adoption proof output.
- Added `trust`, `commands`, and `context` guidance to `projscan plugin test --format json`.
- Added `coordinationHints` to session resources and agent briefs so agents can distinguish current worktree checks, remembered session context, and conflict resolution commands.

### Changed

- PR comment evidence now includes a `### Reviewer Decision` section with a ship/review/fix-first decision, reason, owner state, and first command.
- Dataflow framework-source detection now recognizes Hono route-context request reads such as `c.req.json()` while guarding ordinary Hono-shaped helpers.
- Roadmap data and first-ten-minutes onboarding guidance now live in focused core helpers instead of being embedded only in orchestration modules.


## [3.1.0] — 2026-06-02 — "Trust Boundary Hardening"

### Added

- Added `projscan privacy-check`, a visible trust report that shows telemetry status, offline mode, scan root, Git ignore handling, ignored-file count, `.env` content scanning, plugin execution, local write surfaces, report export sensitivity, and known network-capable endpoints.
- Added `--offline` / `PROJSCAN_OFFLINE=1` / `scan.offline: true` to block known network-capable features across telemetry, npm audit, registry checks, and optional semantic model loading.
- Added explicit opt-ins for trust-sensitive scanning: `--include-ignored` / `scan.includeIgnored: true` for ignored files and `--scan-env-values` / `scan.scanEnvValues: true` for `.env*` value scanning.
- Added a fast `npm run test:trust-smoke` gate covering privacy, offline, MCP start/preflight/watch, Git ignore behavior, session/worktree split, telemetry, and secret-scanning defaults.

### Changed

- Repository scanning now respects Git's visible-file boundary by default: tracked files plus untracked non-ignored files from `git ls-files --cached --others --exclude-standard`.
- `.env*` files are path-only by default: tracked environment files can be flagged by filename without reading their values unless the user explicitly opts in.
- `projscan start` and `projscan preflight` now separate current Git/worktree evidence from remembered session context so old agent-session touches do not look like current risk.
- Local analyzer/reporter plugin trust is surfaced in `privacy-check`; plugins remain disabled unless `PROJSCAN_PLUGINS_PREVIEW=1` is explicitly set.
- The README and first-run guide now lead with the opinionated adoption path: `privacy-check`, `start`, `preflight`, and `evidence-pack` before the larger command catalog.

### Fixed

- Fixed self-scan false positives from trust test fixtures while preserving coverage for explicit `.env` value scanning.
- Fixed changed-file normalization so porcelain status prefixes such as `M ` do not leak into current-worktree paths.
- Fixed MCP file-change notification readiness so watch tests and file-change events are deterministic.

## [3.0.9] — 2026-06-01 — "Opt-in Product Telemetry"

### Added

- Added explicit `projscan telemetry status|enable|disable|explain` controls with default-off anonymous product-health telemetry.
- Added fixed-allowlist telemetry events for command category, success/failure, duration buckets, version/platform, setup booleans, repeat-use buckets, and optional feedback buckets without source code, file paths, repo names, branch names, package names, usernames, raw findings, or secrets.
- Added `TELEMETRY.md` and updated onboarding so `projscan init team` asks teams to make a clear telemetry choice.

### Changed

- `projscan feedback add` can now contribute sanitized usefulness buckets to opted-in telemetry while keeping the structured feedback artifact local and explicit.
- Privacy, README, stability, guide, first-10-minutes, adoption proof, roadmap, and website prompt docs now describe the opt-in telemetry boundary.

## [3.0.8] — 2026-06-01 — "Legal and Trust Hardening"

### Added

- Added public security, privacy, disclaimer, trademark, and third-party notice documents so teams can review vulnerability reporting, local-first data handling, mark usage, warranty limits, and redistributed dependency notices before adoption.
- Added a DCO-backed pull request template and contribution guidance to make contribution provenance explicit for future community changes.
- Added the official projscan icon to the npm package allowlist so downstream documentation and websites can use the canonical asset.

### Changed

- README and issue templates now point developers to the legal and vulnerability-reporting surfaces instead of leaving those expectations implicit.
- The npm package allowlist now ships the legal/trust documents alongside the CLI and existing public documentation.

## [3.0.7] — 2026-05-31 — "Trial Adoption Report"

### Added

- Added `projscan trial`, a local adoption-readiness report that combines onboarding checks, multi-repo validation, reviewer feedback, trust signals, and website-ready proof into one verdict.
- Added `projscan feedback` with `init`, `add`, and `summary` subcommands so teams can capture minutes saved, prevented bad edits, false positives, owner clarity, next-command clarity, and repeat PR use as structured evidence.

### Changed

- `projscan dogfood --feedback` now marks market validation as `proven` only when repo coverage, three or more useful reviewer responses, measured value, false-positive balance, and repeat PR feedback are all present.
- Updated adoption, first-10-minutes, market-validation, guide, README, and website prompt docs around the measured feedback workflow.

## [3.0.6] — 2026-05-31 — "Market Validation Loop"

### Added

- Added structured market-validation evidence to `projscan dogfood --feedback`, including reviewer usefulness, minutes saved, prevented bad edits, false-positive tracking, and website-ready proof markdown.
- Added market-validation docs with the first-PR feedback schema and proof loop.
- Added Baseframe Labs umbrella brand assets, README family-brand footer, and a web-ready RFC 9116 security disclosure file using support@baseframelabs.com.

### Changed

- First-run adoption guidance and PR comments now point teams to the feedback-backed dogfood loop so repeat use is measured instead of assumed.

## [3.0.5] — 2026-05-28 — "Proof of Usefulness"

### Added

- Added an end-to-end team adoption harness that proves `projscan init team` through baseline, generated GitHub Action, PR evidence comment, preflight, and owner routing as one workflow.
- Added a five-scenario PR comment benchmark suite covering docs-only, auth/API ownership, dataflow/security, large release, and generated-code PRs.
- Added `projscan dogfood` to run adoption proof across real repos, reporting PR-comment readiness, repeat-use readiness, MCP readiness, and first-PR feedback questions.
- Added explicit fix-first recommendations across bug-hunt, workplan, start, quality-scorecard, and evidence-pack PR comments so agents know what to fix first, who owns it, and which command proves it.
- Baseline trend memory now records risk direction, quality-score before/after, new/resolved issue counts, and a compact "changed since baseline" summary for PR comments.
- Framework-aware dataflow now recognizes Express request body/query/params/header/cookie sources and keeps JavaScript DB query sinks receiver-sensitive to reduce cache/query false positives.

### Changed

- Evidence-pack PR comments now include required "First Fix" and "Developer Feedback" sections and route changed files through CODEOWNERS/package ownership even when the top risk list is clean.
- `projscan start` now includes an every-PR repeat-use loop with adoption metrics and next commands.
- Large release preflight calibration now labels configured scale-threshold risk as manual release sign-off when no concrete taint, dataflow, health, plugin, or supply-chain blocker exists, including before-merge summaries.
- The generated GitHub Action PR-comment validator now requires the first-fix and suggested-action sections plus at least one exact actionable command.

### Fixed

- Generated-code PR comment benchmarks guard against default generated taint/dataflow anxiety while preserving custom source/sink visibility.
- Dataflow DB sink detection avoids treating unrelated cache-style `query` calls as database sinks unless the receiver/import context is database-like.

## [3.0.4] — 2026-05-28 — "Team Adoption Loop"

### Added

- `projscan init team` bootstraps team policy, GitHub PR evidence workflow, CODEOWNERS starter, baseline memory, a first `projscan start` report, and an onboarding checklist for the first team PR.
- `projscan mcp doctor` verifies client setup and returns paste-ready MCP config for Codex, Claude, Cursor, Continue, Windsurf, Cline, Zed, Gemini, or all clients.
- Evidence-pack PR comments now lead with a reviewer-facing verdict, trust calibration, baseline trend, top risks, team routing, verification commands, exact next commands, and suggested next actions.
- Evidence-pack PR comments now include a validator for required sections, GitHub comment size, render sanity, and actionable commands; generated GitHub workflows run it before posting.
- Baseline diffs now include trend memory for score direction, new hotspots, and recurring noisy rules.
- Workplans now route tasks and top risks through CODEOWNERS or package-owner metadata when ownership is available.
- Added practical analyzer plugin examples for API route ownership, security-sensitive file review, and monorepo boundary checks.
- `projscan start` / `projscan_start` provide a read-only first-60-seconds repo orientation with setup diagnostics, recommended workflow, top risks, adoption gaps, next commands, and optional handoff payload.
- `projscan init policy` writes team policy starter kits for frontend, platform, security, and monorepo teams with conservative overwrite protection.
- `projscan handoff --write <file>` persists the next-agent handoff as a markdown artifact.
- `projscan evidence-pack --pr-comment` renders approval evidence as a concise GitHub PR comment with suggested next actions.
- `projscan init github-action` writes a pull-request workflow that runs projscan, posts PR evidence automatically, and fails only when preflight returns `block`.
- `projscan recipes` now includes team-bootstrap and PR-automation playbooks so teams can install policy, CI, and first-run habits from one catalog.
- `projscan preflight --mode before_commit` now treats scale-only review blocks as manual sign-off cautions while preserving hard blocks for concrete taint, dataflow, health, plugin, supply-chain, and before-merge release gates.

### Fixed

- Release-scale review blocks in evidence-pack PR comments are now labeled as manual release gates instead of actual-defect blockers when preflight reports no concrete taint, dataflow, health, plugin, or supply-chain blocker.
- Bug-hunt now treats pure hotspot churn as a watchlist/top-suspect signal instead of an immediate fix queue when doctor, preflight, and session evidence are clean.

## [3.0.3] — 2026-05-27 — "Agent Review Precision"

### Added

- Package-scoped review now runs inside `computeReview` before verdict calculation, so CLI and MCP callers get scoped cycles, taint, dataflow, contract, graph evidence, summaries, and verdicts consistently.
- Dataflow now recognizes Next-style route request body readers (`request.json()`, `request.formData()`, `request.text()`, `request.arrayBuffer()`) as framework request sources only inside route handlers.
- `projscan dataflow` / `projscan_dataflow` now expose an explicit generated-code opt-in while suppressing default generated/codegen risks by default.
- Ownership lookup now falls back to workspace package owner metadata when CODEOWNERS does not match.

### Fixed

- Package-scoped review no longer blocks on cycles or taint/dataflow risks introduced in other workspace packages, and no longer leaks unrelated package entrypoint contract changes.
- Framework request-source detection now requires a route handler request parameter receiver, avoiding false positives from response helpers such as `Response.json()`.
- Graph caches now rebuild for receiver-sensitive function metadata so framework request-source detection does not use stale bare-call data.
- Review-time generated-code filtering now matches dataflow filtering: default generated risks are quiet, while custom source/sink risks remain visible.
- CI and release workflows use `actions/checkout@v5` and `actions/setup-node@v5`, addressing the Node 20 action runtime deprecation warning.

## [3.0.2] — 2026-05-27 — "Agent Graph Readiness"

### Added

- Release readiness, CI, and the tag-triggered release workflow now run the graph corpus baseline gate so parser, semantic-graph, and dataflow fixture regressions are caught before publish.
- Cross-repo impact boundary summaries now prefer CODEOWNERS-derived owners when sibling repositories expose ownership metadata, falling back to the repo name when no owner matches.
- `projscan_release_train` / `projscan release-train` now understand `3.0.x` graph-readiness and `3.1.x` graph-expansion product lines.

### Fixed

- Custom dataflow sources and sinks are no longer hidden by the broad default file-I/O filter; user-configured flows stay visible unless callers explicitly filter them downstream.
- `npm run release:check` now blocks when an existing remote version tag resolves to a commit other than `HEAD`, including annotated tags via peeled refs.

## [3.0.1] — 2026-05-26 — "Graph Operations Platform"

### Added

- `projscan_review` now includes compact `graphEvidence` so agents can see changed-file count, changed functions, call-edge count, package count, and dataflow-risk count without fetching the full semantic graph.
- Workplans and agent briefs now consume graph/dataflow context directly, including semantic-graph follow-up commands and compact graph metrics for next-agent handoff.
- `computeImpact` now includes cross-repo `boundarySummary` evidence for package and ownership boundaries when sibling repository graphs import target-matching packages.
- Analyzer plugins now receive an optional third `context` argument with lazy read-only `getCodeGraph()`, `getSemanticGraph()`, and `getDataflow()` helpers while keeping manifest schema v1.
- Added `computeGraphCorpus` to produce deterministic semantic-graph/dataflow quality metrics over bundled language fixtures.
- Added `npm run check:graph-corpus` plus `docs/graph-corpus-baseline.json` so parser/dataflow fixture regressions fail only when graph coverage drops or risk counts increase.
- Added a graph-context analyzer plugin example that consumes `context.getSemanticGraph()` and `context.getDataflow()`.
- Preflight now includes optional `evidence.releaseScale` for large platform changes so agents can distinguish expected scale/complexity sign-off from concrete health, taint, dataflow, plugin, or supply-chain blockers.

### Changed

- Split dataflow and review-time dataflow filtering into smaller internal modules while preserving the public CLI, MCP, and npm surfaces.

### Fixed

- Dataflow bridge detection no longer joins collision-prone generic names such as `parse` and `exec` across unrelated files, fixing false review blockers from impossible `env -> exec` paths.
- Default dataflow scans now suppress test-file paths, broad file-IO noise, and misidentified JavaScript child-process sinks unless callers explicitly opt into the broader scan.

## [3.0.0] — 2026-05-23 — "Deep Graph Platform"

### Added

- `projscan_semantic_graph` and `projscan semantic-graph` expose a stable v3 semantic graph contract with file, function, package, and symbol nodes plus imports, package imports, exports, definitions, and calls edges.
- `projscan_dataflow` and `projscan dataflow` report direct, propagated, and bridge source-to-sink risks over the function graph.
- `projscan_review` now surfaces `newDataflowRisks` for bridge-helper patterns and blocks PRs that introduce a new bridge from a source reader to a dangerous sink.
- The npm public API now exports `buildSemanticGraph`, `computeDataflow`, and the associated semantic graph, dataflow, and review dataflow risk types.

### Changed

- Stability docs now define the v3 semantic graph contract, the dataflow risk contract, and the 39-tool MCP surface.
- README, Guide, Roadmap, MCP Registry metadata, and website prompt copy now focus the major release on graph/dataflow adoption by AI coding agents.

## [2.9.0] — 2026-05-23 — "Adoption Layer"

### Added

- `projscan init mcp` now prints ready-to-paste MCP client configuration for Claude Desktop, Claude Code, Cursor, Codex, Continue, Windsurf, Cline, Zed, Gemini, or all supported clients.
- `projscan recipes` now prints adoption workflow recipes for before-edit, bug-hunt, release approval, handoff, and pre-merge agent loops.
- `projscan first-run` now diagnoses first-run setup across Node.js, package metadata, Git state, `.projscanrc`, Tree-sitter runtime presence, local plugin manifests, and MCP stdio startup.
- `projscan_adoption` exposes the same MCP configuration snippets, workflow recipes, and first-run diagnostics to agents through one structured MCP tool.
- Added a packaged Plugin Gallery with policy, team health, security radar, and release readiness examples.

### Changed

- `projscan doctor` console output now ends with adoption-oriented next commands for preflight, bug-hunt, and recipe discovery while keeping machine-readable formats unchanged.
- `projscan preflight` console output now shows required checks and an agent-workflow follow-up while keeping the JSON report shape unchanged.
- README, Guide, Stability, package smoke tests, and website prompt copy now describe the adoption-layer workflows and 37-tool MCP surface.

## [2.8.0] — 2026-05-22 — "Agent Mission Control"

### Added

- `projscan_workplan` now composes preflight, review, session, hotspot, plugin, and supply-chain signals into an ordered agent execution plan with priorities, evidence, suggested tools, verification commands, and short handoff text.
- `projscan workplan` exposes the same planner through the CLI with modes for `before_edit`, `before_commit`, `before_merge`, `refactor`, `release`, `bug_hunt`, and `hardening`.
- `projscan handoff` prints a concise next-agent handoff from the current workplan, including the next tasks and coordination recommendation.
- `projscan_release_train` / `projscan release-train` plan upcoming product lines in one readiness view with version, preflight, scope, and next-action evidence.
- `projscan_bug_hunt` / `projscan bug-hunt` compose doctor, preflight, hotspot, and session signals into a prioritized fix queue with verification commands for each target.
- `projscan_evidence_pack` / `projscan evidence-pack` assemble planning, bug-hunt, workplan, preflight, changelog, and optional website prompt evidence into one approval packet.
- `projscan_regression_plan` / `projscan regression-plan` build smoke, focused, or full regression matrices from bug-hunt, preflight, and product risk.
- `projscan_agent_brief` / `projscan agent-brief` create compact next-agent context packets with focus items, guardrails, repo context, and suggested next actions.
- `projscan_quality_scorecard` / `projscan quality-scorecard` summarize health, security, tests, maintainability, coordination, top risks, and verification commands.

### Fixed

- Full-suite test stability now uses a 60s Vitest test/hook budget and guards git-heavy temp-repo cleanup paths, preventing false negatives under subprocess load.

## [2.2.0] — 2026-05-21 — "Supply-Chain Trust Gate"

### Added

- `projscan doctor`, `projscan preflight`, and MCP `projscan_preflight` now surface supply-chain findings for known malicious TanStack Mini Shai-Hulud indicators, hidden editor persistence hooks, risky install lifecycle scripts, pinned GitHub commit dependencies, and large obfuscated JavaScript payloads.
- `projscan preflight` now includes `evidence.supplyChain`, supply-chain reason sources, and a dedicated required check so agents can distinguish dependency trust issues from general health or plugin policy failures.
- Release validation now runs a built-artifact supply-chain gate, `npm audit`, npm signature verification, and emits a CycloneDX SBOM attached to GitHub releases.
- `npm run release:check` now gives maintainers a local release-readiness report covering version metadata, changelog presence, git worktree state, local/remote tag state, release gates, and the exact next action.

### Fixed

- Lockfile IOC scanning now catches malicious `resolved` URLs even when a package entry has no nested dependency map.
- Lockfile IOC scanning now reads normal large npm lockfiles instead of silently skipping supply-chain checks after the first 2 MB.
- Root `node_modules/<pkg>` package-lock entries are parsed correctly for both supply-chain analysis and SBOM component names.
- `projscan_review` now short-circuits identical base/head refs instead of doing a full head scan, hotspot pass, and temporary base worktree for an empty diff.
- `prepare` lifecycle filtering now flags direct package execution such as `npx`, `npm exec`, `pnpm dlx`, and `yarn dlx` while preserving the existing `npm run build` allowance.
- Updated the `brace-expansion` and `protobufjs` overrides and lockfile to the safe transitive ranges used by the release gate.

## [2.1.0] — 2026-05-18 — "Agent Trust"

### Added

- `projscan preflight` and MCP `projscan_preflight` now return an agent-sized `proceed` / `caution` / `block` verdict with evidence, required checks, and suggested next tool calls.
- Added MCP resources `projscan://session/summary`, `projscan://handoff`, and `projscan://risk-now` for multi-agent coordination over the shared session.
- `projscan plugin init` and `projscan plugin test` now scaffold local analyzer/reporter plugins and validate their runtime behavior with structured diagnostics.
- `projscan_review` now includes optional `contractChanges` for exported symbol renames/additions/removals and Node package entrypoint/public export changes.
- `projscan analyze --format html` now emits a self-contained HTML analysis report instead of falling through to console output.
- `npm run smoke:packed-install` now installs the packed npm tarball into a fresh temp project and verifies the CLI, MCP stdio startup, plugin loading, and core JSON commands outside the repo checkout.
- Command format support is now machine-readable from one shared source and rendered by `projscan help`.
- Added a website update prompt for downstream site refreshes after npm/GitHub/MCP Registry releases.

### Fixed

- Unsupported CLI `--format` combinations now fail with a clear command-specific diagnostic instead of silently rendering console output.
- Default repository scanning now ignores projscan's own local state directories (`.projscan-cache/`, `.projscan-memory/`) and OS metadata files (`.DS_Store`, `Thumbs.db`).
- Local plugin modules now load through Node's runtime importer so file-based plugins continue to work under Vite/Vitest-backed environments.
- Local plugin load failures now explain missing modules, syntax errors, missing analyzer/reporter exports, and unsupported reporter commands with actionable manifest/module hints.
- Upgraded the dev Vitest/Vite test stack to a Node 18-compatible safe range so `npm audit` no longer reports the esbuild dev-server advisory.

### Documentation

- Refreshed CLI help, README, Guide, and Stability docs so command-dependent format support includes HTML and reflects the 2.0 Plugin Platform release.
- Audited README trust copy, MCP Registry metadata, and registry republish instructions for the 2.0 release line.

## [2.0.0] — 2026-05-18 — "Plugin Platform"

projscan 2.0 stabilizes the local plugin platform and uses the major-version
boundary to clean up deferred 1.x public API surfaces. MCP tool names and input
schemas remain stable.

### Added

- Stable local analyzer/reporter plugin contract for `.projscan-plugins/*.projscan-plugin.json` manifests with `schemaVersion: 1`.
- Machine-readable plugin manifest schema at `docs/plugin.schema.json`, plus tested analyzer and reporter examples under `docs/examples/plugins/`.
- CLI JSON `schemaVersion: 2` metadata on built-in JSON reporters.
- `BuiltinLanguageId` for the closed set of bundled adapters while keeping `LanguageId` extensible for plugin-provided languages.

### Changed

- CLI/MCP file explanations now use the multi-language AST graph path instead of deprecated JS/TS-only regex helpers.
- Custom presentation, white-label reports, and team-branded output are documented as reporter-plugin responsibilities rather than core HTML theming flags.
- Release validation now opts GitHub Actions JavaScript actions into the Node 24 runtime and keeps MCP Registry descriptor constraints under test.
- Stability baseline refreshed for the 2.x public CLI/MCP surface.

### Removed

- Deprecated regex `extractImports` and `extractExports` helpers from the npm public API.

### Migration

- See [2.0 Migration Guide](docs/2.0-MIGRATION.md).

## [1.11.0] — 2026-05-18 — "Reporter Plugins"

Reporter plugin preview for CLI output, docs, and demo media. No MCP wire breakage.

### Added — reporter plugin preview

- Local plugin manifests may now declare `kind: "reporter"` with `commands: ["doctor" | "analyze" | "ci"]`. Reporter modules export `render(context)`, returning the CLI output string for a supported command.
- New CLI flag **`--reporter <name>`** on `projscan doctor`, `projscan analyze`, and `projscan ci`. Reporters stay behind **`PROJSCAN_PLUGINS_PREVIEW=1`**, matching the analyzer preview gate.
- Reporter execution is isolated: unsupported commands, missing exports, non-string returns, and thrown render errors produce clear CLI failures without changing the default console or JSON output paths.

### Changed

- **`projscan_plugin`** and `projscan plugin list | validate` now understand analyzer and reporter manifests. The MCP tool remains structured and validation-oriented; reporter rendering is intentionally CLI-only.
- Plugin diagnostics now distinguish analyzer-specific `category` requirements from reporter-specific `commands` requirements.
- `projscan ci --reporter <name>` preserves CI policy behavior: reporter output can customize the console view, but threshold failures still exit non-zero.

### Documentation

- README now leads with a generated macOS-style reporter plugin demo (`docs/projscan-reporter-plugin.png` / `.gif`) and includes a reporter quick-start.
- [Plugin Authoring](docs/PLUGIN-AUTHORING.md) now documents reporter manifests, `render(context)`, supported commands, and CLI-only behavior.

## [1.10.0] — 2026-05-13 — "RC for 2.0"

Analyzer plugin API preview, live cost-summary streaming, and five fixes.

### Added — analyzer plugin API preview

- New MCP tool **`projscan_plugin`** + CLI **`projscan plugin list | validate <manifest>`**. Discovers and validates `.projscan-plugins/*.projscan-plugin.json` manifests against the 1.10 schema. The tool is always registered (so agents can probe for it), but plugins only load when **`PROJSCAN_PLUGINS_PREVIEW=1`** is set in the environment — without the flag, `enabled: false` is returned and the issue stream is unchanged.
- Plugin shape: `{ schemaVersion: 1, name, kind: "analyzer", module, category, description? }`. Modules export `{ check: (rootPath, files) => Promise<Issue[]> }`. Issue ids from plugins are prefixed `plugin:<name>:` so two plugins emitting the same local rule id can't collide.
- One plugin crashing or returning malformed `Issue` records is isolated — other plugins still load and contribute.
- Path-traversal guard on `module`: absolute paths and `..` segments are rejected at validation time.
- The schema may shift before 2.0 — that's what the preview gate is for. 2.0 will commit it under the stability contract.

### Added — live cost-summary streaming

- `projscan_cost_summary` gains `action: "start_stream" | "stop_stream" | "list_streams"`. The existing snapshot mode is `action: "snapshot"` and remains the default, so existing callers see no change.
- `start_stream` registers a watch; every `interval_seconds` (default 10, range 2–600) the server polls the session log and emits **`notifications/projscan/cost_delta`** when new tool calls have accrued. Ticks with no new activity are silent.
- Notification payload: `{ streamId, sessionId, perTool: [{ tool, callsAdded, tokensAdded, cumulativeCalls, cumulativeTokens }], cumulative: { totalCalls, totalEstimatedTokens } }`.

### Fixed

- **`projscan_apply_fix` rollback now removes parent dirs that the forward `op:'create'` brought into existence**, deepest-first via `rmdir` (which silently no-ops on non-empty dirs, so unrelated siblings survive). The rollback record carries a new optional `createdParentDirs` field; older records written by 1.9 and earlier still roll back the file the old way.
- **`projscan_apply_fix` rollback of `op:'delete'` `mkdir -p`'s the parent dir before re-creating the file.** Previously, if a separate process had pruned the now-empty parent dir between apply and rollback, `atomicWriteFile`'s `fs.open(tmp, 'wx')` would `ENOENT` and the rollback would partial-fail silently.
- **`incrementallyUpdateGraph` no longer derives package-root context from a pre-update graph view.** Adapter contexts are now computed after the parse pass, so a newly-added manifest (`pyproject.toml`, `Cargo.toml`, `go.mod`) batched with source files influences that batch's import resolution instead of staying stale until the next tick.
- **`git diff --name-only` output larger than the 10MB buffer is surfaced with a specific reason** (`git diff against "X" exceeded the 10MB output buffer ... use --base-ref to pin a closer ref`) instead of falling through to a misleading "no usable base ref found".
- **`projscan_taint` BFS caps the per-step frontier at 5000 candidates.** Wide-fan-out graphs (Java/TS with prevalent `get` / `set` / `toString` bare-name collisions) previously could balloon the frontier exponentially when each bare-name callee resolved to thousands of same-named functions. The source is surfaced in `truncatedSources` when the cap fires, matching how `MAX_DEPTH` truncation is reported.
- **`startWatcher` no longer fires `onChange` after `close()`.** An in-flight debounce flush that raced past the top-of-function `closed` check now re-checks before invoking the callback, so a stopped watcher never delivers a stale event. A new `WatchHandle.closed` promise lets orderly-shutdown callers await full quiet after `close()` returns.

### Changed

- `ApplyChange` gains optional `createdParentDirs?: string[]` for `op:'create'` records.
- `WatchHandle` gains `closed: Promise<void>` alongside the existing `close(): void`.

## [1.9.0] — 2026-05-12 — "Intent + Polish"

Headline: **intent-grounded review** — agents can hand projscan a free-text PR description and get each finding labelled `expected` / `unexpected` / `out-of-scope`. No LLM involved.

### Added — intent-grounded review (`projscan_review` + `intent`)

- `projscan_review` accepts a new optional **`intent`** string argument. projscan parses it rule-driven — no LLM — into:
  - an **action type** (`feature` / `fix` / `refactor` / `perf` / `test` / `docs` / `chore` / `remove` / `unknown`), and
  - a list of **scope tokens** (identifiers, file paths, module names) extracted from the prose with English stopwords + generic path components (`src`, `lib`, `dist`, ...) + action keywords filtered out.
- Every changed file, risky function, new cycle, new taint flow, and dependency-change record gets an **`intentAlignment`** field: `expected` (in scope + typical for the action), `unexpected` (in scope but atypical — e.g. docs PR that introduces a new taint flow), `out-of-scope` (outside the area the agent named), or `unknown` (action could not be classified).
- The report carries an **`intent` echo** (raw + parsed action + scope tokens) and an **`intentAnalysis`** block with per-alignment totals and up to 5 "notable" findings biased toward unexpected.
- The verdict (`ok` / `review` / `block`) is **deliberately unaffected** by intent — verdict stays structural. Intent is an extra narration layer on top so the agent can say "you intended X, you also got Y."
- **Path-boundary scope matching.** Token "auth" matches `src/auth/index.ts` and `use_auth_hook` (boundary on each side) but NOT `authority/database.ts` (no boundary). A naive substring match would have declared nearly every file in-scope.
- **Type-rooted intents**: `docs` + a docs path (README, `.md`, `docs/**`) is intrinsically in scope even without an explicit token hit. Same for `test` + a test path. Agents don't have to enumerate every file.
- The summary array picks up one or two extra bullets when intent is set: `Intent: "feature" (scope: auth, session).` plus a `N finding(s) unexpected for this intent — e.g. …` when applicable.
- **Pathological-input cap**: intent argument is capped at 8K chars before any regex passes run, to prevent catastrophic backtracking on hostile input.

### Added — Project Memory loop #4: per-rule severity drift

- New `computeSeverityDrift(memory, ruleId)` returning `'stable' | 'noisy' | 'cry-wolf'`:
  - **cry-wolf**: rule surfaced ≥ 10 runs with zero fixes. Driving agents should drop the rule's severity one level (error → warning, warning → info, info → drop).
  - **noisy**: rule surfaced ≥ 5 runs with fix-rate < 0.2. De-emphasize.
  - **stable**: any other case.
- Surfaced via `projscan_memory action: confidence` — each tracked rule now carries a `drift` field and the response includes a `driftCounts` summary alongside the existing `counts`.
- Suppressed-in-config rules (`.projscanrc disableRules`) are excluded — that's a deliberate signal, not drift.

### Added — `projscan_review_watch` signature deepening

- The change-detection signature was previously a flat string of verdict + SHAs + counts. Replaced with a structured **`WatchSnapshot`** that fingerprints cycles (sorted file lists), risky functions (file + name keys), taint flows (source-fn::sink-fn keys), and dependency changes split into adds / removes / bumps.
- The `notifications/projscan/pr_changed` payload now carries a **`delta`** field with:
  - `changeKinds`: which buckets actually moved (`verdict` / `baseSha` / `headSha` / `changedFiles` / `cycles` / `risky` / `taint` / `deps`)
  - per-bucket counts: `cycles: { added, removed }`, `risky: { added, removed }`, `taint: { added, removed }`, `deps: { added, removed, bumped }`
- Lets agents react to a specific dimension without re-reading the full report. A dep-only change can trigger a `projscan_audit` re-run; a verdict change can short-circuit to "rebuild the review summary."
- Bucket semantics: each counter reports records that NEWLY appeared. Reverts (records that vanished) trigger `changeKinds.push('deps')` so the agent knows something moved, but they don't increment counters — counting them would conflate "PR newly adds foo" with "PR no longer removes foo," which mean different things to a reviewer.

### Added — cross-arch CI (macOS leg)

- CI matrix now includes `macos-latest` on Node 22 alongside `ubuntu-latest` × Node {20, 22, 24}. Catches the wasi-sdk + tree-sitter wasm build chain differences across darwin and linux without bloating the matrix (the macOS leg exists to validate the grammar-build chain, which one Node version exercises as well as three).

### Fixed

- **`projscan_doctor` no longer crashes with EMFILE on large repos.** `securityCheck.ts` was using unbounded `Promise.all` over filtered files; a 50K-file repo opened 50K concurrent `fs.readFile` and tripped macOS's default 256 ulimit. Routed through the existing `mapWithConcurrency(128)` helper.
- **`git` invocations now have a 30s default timeout.** Previously a hung git operation (credential prompt against a dead remote, blocking git hook, slow NFS) could hang the MCP server forever. Added `DEFAULT_GIT_TIMEOUT_MS` to both `prDiff.runGit` and `review.runGit`. Stdin is now also detached (`stdio: ['ignore', 'pipe', 'pipe']`) so hooks/prompts see EOF and exit instead of waiting.
- **Watcher noise from atomic writes.** The `shouldSkip` filter now matches `.projscan-tmp-` so `atomicWriteFile` siblings don't generate redundant rename/create/unlink events. Previously every `projscan_apply_fix` write in the repo body fired three watcher events per file.
- **Rollback record is now atomic.** The recovery oracle (`.projscan-cache/rollbacks/<id>.json`) was being written with non-atomic `fs.writeFile`. A crash mid-write left corrupt JSON that `rollback` parsed as null, stranding the user with applied changes and no way to revert. Now uses `atomicWriteFile` like the rest of the apply pipeline.
- **`repositoryScanner.totalDirectories` off-by-one on some walkers.** Empty-string `directory` keys (from file walkers that emit `''` instead of `'.'` for root files) inflated the count by one. Now filtered.
- **`computeFanOut` perf hoist.** The inner-loop `bareName(fn.name)` was re-computed per callee — on a 50K-file repo with average fan-out, ~30M redundant string-slice ops per scan. Hoisted to per-function constant.

### Changed

- `ReviewReport` type gains optional `intent` and `intentAnalysis` fields. Absent when no `intent` arg was passed — strict addition, no break.
- `ReviewFile` / `ReviewFunction` / `ReviewCycle` / `ReviewTaintFlow` / `ReviewDependencyChange` each gain an optional `intentAlignment` field. Same — absent when no intent.
- `reviewWatchTool` description updated to mention the deepened signature + `delta` payload.
- `memoryTool` description updated to mention the new `drift` field surfaced in `confidence` action.

## [1.8.1] — 2026-05-08

Documentation patch. Surfaces the MCP clients we already work with but didn't document.

### Added

- README integration sections for **Codex CLI (OpenAI)** and **Gemini CLI (Google)**. projscan implements the MCP 2025-03-26 spec; both Codex and Gemini are conformant MCP clients, so the protocol-level support has been there since 1.0.0 — only the setup snippet was missing. No code changes.
- Tagline + commands table now mention both alongside Claude Code, Cursor, Windsurf, Cline, Continue, and Zed.

## [1.8.0] — 2026-05-08 — "Resilience + Live"

Adds the Swift language adapter and the `projscan_review_watch` long-running PR review tool.

### Added — Swift adapter (`.swift`)

- Full tree-sitter integration. Imports (incl. `import struct Foo.Bar`, `@testable import`), visibility-aware exports (private / fileprivate hidden; public / internal / open visible), per-function CC with `switch`-arm counting (default not counted) and guard / for / while / do / catch handling, call-site extraction across navigation expressions, package-root detection from SwiftPM `Package.swift` / `Sources/` layout. **11 languages now**.
- **Build chain**: tree-sitter-swift's `parser.c` (540k LoC) trips a hard `you must have emcc/docker/podman on PATH` check inside the `tree-sitter` cli even when wasi-sdk is locally available. `scripts/copy-wasm.mjs` now bypasses the cli and invokes wasi-sdk's clang directly with the same flags the cli uses internally (`-Os -fPIC -shared -nostdlib -Wl,--no-entry --target=wasm32-unknown-wasi`). The path probe honors `TREE_SITTER_WASI_SDK_PATH` and falls back to the OS-conventional cache (`~/.cache/...` on Unix; `%LOCALAPPDATA%\tree-sitter\wasi-sdk` on Windows).

### Added — `projscan_review_watch` (long-running PR review)

- New MCP tool. Polls a `base + head` ref pair on a configurable interval (default 30s, range 5–600s) and emits `notifications/projscan/pr_changed` whenever the review verdict, base/head SHAs, changed-file count, new-taint-flow count, or risky-function set changes. The capstone for the agent-substrate arc — `projscan_review` is a snapshot, this is the stream.
- Actions: `start` (returns initial review + watchId), `stop` (cancels by watchId), `list` (enumerate active watches).
- Server-side lifecycle: each watch is registered with the MCP server's tool-watch registry; `close()` cancels all timers so polling can't outlive the server. Single-flight per watch — overlapping ticks during a slow `computeReview` are dropped, not queued.
- Tool-side context plumbing: `McpToolHandler` signature is now `(args, rootPath, context?: McpToolContext)`. Existing tools ignore the third arg and continue to operate as before.

### Added — Project Memory + cost analytics deepening

- **Taint depth reporting**: `projscan_taint` now returns `truncated: boolean`, `truncatedSources: string[]`, and `maxDepth: number` so agents know when the BFS hit its cap. The cap is also raised from 8 → 12 (real user repos average 10–11 hops between an HTTP handler and a shell-exec sink); the BFS data structures and visited-set are unchanged.
- **Cost p95 saturation guard**: `projscan_cost_summary` returns `observedP95Tokens: null` plus `observedP95InsufficientSamples: true` when fewer than 20 samples are available. Saturating at the observed max for tiny samples misled agents into budgeting on a worst-case spike rather than a representative high-water mark.

### Fixed — bug-hunt round (audit-driven)

- **Atomic session save**. `session.saveSession` now uses the same `atomicWriteFile` (tmp + fsync + rename + parent-dir fsync) that `applyFix` has used since 1.6.0. Crashes mid-write can no longer truncate `.projscan-cache/session.json` to zero bytes, and concurrent writers can't half-clobber each other. The atomic-write helper is extracted to `src/utils/atomicWrite.ts` and shared. Cleanup on rename failure unlinks the abandoned tmp file so retries don't accumulate disk droppings.
- **Embeddings pipeline LRU**. The pipeline cache is now bounded at 2 cached models with LRU eviction. Long-running MCP servers that switch models (or test runs that thrash) no longer accumulate ~200 MB per model indefinitely.
- **Templated C++ qualified-id translation**. `translateScopeOperator` walks chars while tracking angle-bracket depth, so `Foo<std::pair<int,int>>::bar` now correctly emits `Foo<std::pair<int,int>>.bar` instead of `Foo<std.pair<int,int>>.bar`. The previous bare `replace(/::/g, '.')` would corrupt template-argument types in declarators.
- **review_watch race conditions** caught in the bug hunt: (1) `watchId` is now assigned BEFORE the `setInterval` is armed (was: timer fires capturing a `null` watchId in the closure for ≥ 5000 ms); (2) `runTick` is single-flight per watch (was: overlapping ticks during slow `computeReview` could deliver out-of-order notifications); (3) `stop` always cleans the module-level `watches` map regardless of whether the server registry knew about it (was: orphaned state across cross-transport stops).

## [1.7.0] — 2026-05-07 — "Reach + Visibility"

Adds Kotlin and C++ language adapters, Project Memory's per-rule confidence loop, and a cost-summary MCP tool.

### Added — language adapters

- **Kotlin (`.kt`, `.kts`)** — full tree-sitter adapter: imports (incl. wildcards + aliases), visibility-aware exports (private / internal hidden), per-function CC with `when`-arm counting (else not counted), call-site extraction, package-root detection from Gradle / Maven layouts. Closes the JVM gap that previously stopped at Java. Bumps the supported-languages count from 9 to 10.
- **C++ (`.cpp`, `.cc`, `.cxx`, `.c`, `.h`, `.hpp`, `.hxx`)** — full tree-sitter adapter: `#include` resolution (quoted relative-to-importer + project include roots), top-level decl exports (functions, classes, structs, enums, type aliases), per-function CC with `case`-label counting (default not counted) and out-of-line method qualified-name handling (`Foo::bar` → `Foo.bar`), call-site extraction across qualified, field, and template expressions. Closes the systems-languages gap.
- **Build chain**: `tree-sitter-kotlin` doesn't ship a prebuilt wasm; `scripts/copy-wasm.mjs` now invokes `tree-sitter build --wasm` at install time using the bundled wasi-sdk. `tree-sitter-cli` is a new devDep — runtime users pay nothing.
- **Swift adapter** is **deferred to 1.7.1**: tree-sitter-swift's parser size requires emcc / docker that we couldn't bring online from this build environment. Design is preserved and will ship in the next patch.

### Added — Project Memory loop #3 (per-rule confidence)

- New `computeRuleConfidence(memory, ruleId)` and `computeRuleConfidenceScore(...)` in `src/core/memory.ts`. Returns `'high'` when the user has actively fixed instances of a rule (`fixedCount > 0`), `'low'` when the rule has surfaced over ≥ STABLE_RULE_RUN_COUNT runs spanning ≥ STABLE_RULE_DAYS days without ever being fixed, and `'medium'` otherwise. Numeric score in `[0, 1]` for ranking.
- `projscan_fix_suggest` MCP tool now attaches a `confidence: { level, score }` sidecar to every result so agents can deprioritise rules the user has historically tolerated.
- `projscan_memory` gains a new `confidence` action that returns every tracked rule labelled and ranked, plus per-level counts (high / medium / low). Pairs with the existing `stable` and `accepted` views.

### Added — cost visibility (aggregate analytics)

- New MCP tool **`projscan_cost_summary`** that aggregates the `_cost` sidecar (1.5+) across the session event log: total tokens, top spenders, per-tool typical / p95 token estimates, plus a static `expectedTokens` catalog so an agent can budget pre-call.
- The MCP server now folds the post-budget `estimatedTokens` into each `tool-call:*` session event (1.7+), so the cost summary can derive per-tool stats automatically. Older sessions without cost data are handled gracefully (typical / p95 read as 0). Aware of the bounded log (last 500 calls) — documented in the tool description.

### Fixed — bug-hunt round (audit-driven)

- **Kotlin / C++ branch detection** — `when_entry` else-arm and `case_statement` default-arm detection switched from text-regex (fragile around comments / whitespace) to structural checks (`when_condition` child presence; tree-sitter-cpp's `value` field). Caught a real CC-by-one in the kotlin classify integration test.
- **Future-dated timestamps in confidence math** — `computeRuleConfidence` now requires `ageMs > 0` before classifying a rule as `'low'`, so clock skew or corrupt memory falls back to `'medium'` instead of silently ageing into a low-confidence cliff.
- **Memory tool error-message drift** — the unknown-action error now lists `confidence` alongside the other actions; matches the input-schema enum.
- **Concurrent ensureSession race** — multi-request bursts could each load and save their own session copy, last-write-wins dropping touches and events. The MCP server now gates `ensureSession()` behind a single in-flight `Promise`, so concurrent callers share the loaded session.
- **Session event-log overflow race** — `recordEvent` now bounds-then-pushes (rather than push-then-bound), so two interleaved calls can't briefly leave the array one-over MAX_EVENTS or drop a different entry depending on order.
- **`looksLikePath` substring `..` check** — the session touch scanner rejected legitimate filenames like `before..after.txt` and `..hidden` with a substring check; switched to a segment-based check matching `session.normalizeFile` and `applyFix.isSafeRelativePath`.

## [1.6.2] — 2026-05-06

Hardening release fixing seven bugs surfaced after 1.6.0.

### Fixed

- **`projscan_review` no longer emits false-positive risky-functions on JS files with multiple anonymous arrows.** `findRiskyFunctions` keyed `baseByName` by `fn.name`, so all `<anonymous>` callbacks (the dominant real-world case — every unbound arrow gets that name from `ast.ts:nameForFunctionNode`) collapsed into a single map entry. Every head `<anonymous>` then compared against the LAST base `<anonymous>`'s CC, producing false-positive `crossed-threshold` / `jumped` rows on essentially every file with ≥2 anonymous arrows of differing CC. Live since 0.13.0. Fixed by switching to a multimap and skipping the CC-delta check when EITHER side has more than one function with that name.
- **`projscan_apply_fix` rejects path-traversal in `rollback_id`.** `readRollbackRecord` joined an unvalidated `rollback_id` into a path, so a hostile MCP client passing `rollback_id: "../../foo"` could read any `*.json` under cwd through `path.join`'s relative-segment collapse. Fix: strict UUID v4 regex validation (pinned to v4 since `crypto.randomUUID()` always emits v4) before the read.
- **`projscan_session` accepts legitimate filenames containing `..` substrings.** `normalizeFile` rejected any file whose path contained the literal `..` substring anywhere — wrong shape of guard. Names like `before..after.txt` and `..hidden` were silently dropped. Fix: segment-based check matching `applyFix.isSafeRelativePath`.
- **`projscan_file` rejects absolute paths and resolves symlinks before the inside-root check.** The MCP tool's docs claim "relative to project root" but the prior implementation silently honored absolute paths. Worse: a symlink under the repo (e.g. `cache/keys.pem` → `/etc/passwd`) passed the prefix check but read attacker-chosen content. Fix: reject absolute paths up front; canonicalize both root and target via `realpath` before the inside-root check (which also fixes a subtle macOS regression where `mkdtemp` returns `/var/folders/...` but the canonical form is `/private/var/folders/...`).
- **`atomicWrite` is now crash-durable and TOCTOU-resistant.** Three hardenings to `applyFix.atomicWrite`: tmp filename uses `crypto.randomUUID()` instead of `pid + Date.now()` (was predictable to ~µs); open with `'wx'` (`O_CREAT | O_EXCL`) so a planted symlink at the tmp path is rejected with EEXIST; `fsync` the file before rename and best-effort `fsync` the parent dir after — the docstring claimed partial-state-not-allowed, but without fsync the rename can survive a crash with empty content.
- **`git worktree add` argv adds `--` separator.** Defensive: `baseSha` is verified through `rev-parse --verify ... ^{commit}` upstream, so refs starting with `-` can't slip through today, but the separator means a future caller passing an unverified ref can't argument-inject (e.g. `--upload-pack=evil`).
- **`applyFix.ts:147` `.reverse()` mutation.** Latent bug — `[...completedIdx].reverse()` instead of `completedIdx.reverse()` in the rollback loop. Only iterated once today, but a footgun for any future maintainer.
- **`src/mcp/prompts.ts:472` lint cleanup.** Stray escaped backticks inside a single-quoted string emitting `no-useless-escape`. CI on `main` had been red since the 1.5.0 security commit; nobody noticed because lint isn't part of the local pre-commit gate. Fixed and added to the gate.

### Added — performance

- **Bounded file-I/O concurrency.** `buildCodeGraph`, `buildSearchIndex`, and `attachExcerpts` previously did `Promise.all(files.map(async))` — an unbounded fan-out that opened an FD per file. On a 10K-file repo this issued 10K concurrent `fs.stat + fs.readFile`, far exceeding macOS's default 256 open-files ulimit and tripping EMFILE on cold scans. New helper `mapWithConcurrency` (default 128) batches the work. Zero behavior change for small repos; correctness fix on large ones.
- **Skipped redundant `JSON.stringify` per non-truncated MCP tool call.** Every tool result re-stringified the post-budget payload to compute the `_cost` sidecar — but `applyBudget` already produced exactly that number for the non-truncated case. Now reuses the cached value. For a 200KB response that's ~4MB of throwaway string work saved per call.

### Added — release pipeline

- **Tag-triggered Release workflow.** Pushing `vX.Y.Z` now: validates `package.json` + `server.json` versions match the tag; runs the full build/test/lint/stability gate; slices the matching CHANGELOG entry; publishes to npm with provenance; creates the GitHub Release with `dist/tool-manifest.json` attached. Replaces the old release-published-triggered workflow. Manual surfaces left: MCP Registry republish (interactive OAuth, can't run safely in CI today) and the website edits. See `CONTRIBUTING.md` for the new ritual.

## [1.6.1] — 2026-05-06

Patch release. Two fixes that surfaced after 1.6.0 went out, plus the release pipeline that should have been part of 1.6.0.

### Fixed

- **`projscan_review` no longer false-positive-blocks safe PRs when the base graph fails to parse.** 1.6.0's new-taint-flow detection diffed `(sourceFn, sinkFn)` pairs between base and head; if the base graph couldn't be parsed (worktree problem, transient adapter failure), `baseFlowKeys` was empty and *every* head flow was flagged as new — the verdict avalanched to `block`. A flow is now only "new" if at least one file in its path is in the PR's changed-file set. Strictly tighter — any genuinely-introduced flow must touch a modified file by construction (the new source-fn, sink-fn, or intermediate hop), so this never drops a real flow. Thanks to a post-1.6.0 review pass for catching it.
- **`src/mcp/prompts.ts` lint cleanup.** Stray `\\\``-style escapes inside a single-quoted string were emitting `no-useless-escape` errors that CI had been failing on silently since 1.5.0. Real bug: not user-visible, but main was red.

### Added

- **Tag-triggered Release workflow (`.github/workflows/release.yml`).** Replaces the old `publish.yml` (which fired on `release.published`). Pushing `vX.Y.Z` now: validates `package.json` + `server.json` versions match the tag, runs the full build/test/lint/stability gate, slices the matching CHANGELOG entry, publishes to npm with provenance, and creates the GitHub Release with `dist/tool-manifest.json` attached. Idempotent on re-run via `workflow_dispatch`. Strict-semver gate rejects prerelease tags up front. The MCP Registry republish stays manual (mcp-publisher needs interactive OAuth).

## [1.6.0] — 2026-05-06 — "Operator"

projscan grows from a *report-and-suggest* tool into a *report-and-act* tool, and learns to look across repository boundaries. Three pillars: cross-repo intelligence over registered sibling repos, an apply layer that mechanically executes the safest fix templates with rollback support, and a security-aware review that surfaces newly-introduced source-to-sink taint flows.

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

- Taint analysis is intentionally heuristic: it answers "does some call chain reach from a function reading a source to a function calling a sink?" not "is this variable actually tainted at the sink?" False positives are expected for functions that launder taint safely; false negatives happen for flows through `eval`'d strings or plugin loaders. Tune by adding sinks under `.projscanrc.json` `taint.sinks` and silencing rules under `disableRules`.

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
