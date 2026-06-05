# Website Update Prompt

Use this prompt when updating the public projscan website after the npm, GitHub, and MCP Registry release surfaces are live.

```text
Update the projscan website for projscan 3.5.0.

Headline for this release (3.5.0 — "Plugin Trust"):
- Local plugins now run under trust-on-first-use: even with PROJSCAN_PLUGINS_PREVIEW=1, a plugin module only executes after its exact bytes are approved with `projscan plugin trust <name>`, and a changed module reverts to untrusted. Approving a plugin is a deliberate CLI action and is never exposed over the MCP server.
- `projscan fix` installs dev tooling with `npm install --ignore-scripts`, so applying a fix in an untrusted repo can no longer run that repo's npm lifecycle scripts.

Core positioning:
- Name: projscan
- MCP Registry name: io.github.abhiyoheswaran1/projscan
- Registry description: Agent-first code intelligence over MCP. 11 langs, 42 tools, repo understanding. Local.
- One-line homepage copy: Agent-first code intelligence for AI coding agents: repo understanding, cited claims, semantic graph, dataflow risk detection, MCP setup, team bootstrap, PR evidence, measured adoption proof, workplans, bug-hunt queues, preflight safety, review intelligence, shared session context, and local team plugins.
- Install: npm install -g projscan
- Run without install: npx projscan
- MCP server command: npx -y projscan mcp
- Requirements: Node.js >= 18

Baseframe Labs umbrella requirements:
- Treat Baseframe Labs as the umbrella brand/family only, not the legal subject and not a formed LLC/corp.
- Use support@baseframelabs.com for generic support and vulnerability-disclosure contact.
- Add a small footer link reading part of Baseframe Labs with /brand/baseframe-labs/wordmark-light.svg on light backgrounds or wordmark-dark.svg on dark backgrounds.
- Serve /.well-known/security.txt with RFC 9116 Contact, Expires, Preferred-Languages, and product-appropriate Canonical/Policy only when the deployed domain has those URLs.
- Do not rename projscan, rewrite privacy/terms legal subjects, or add corporate designators for Baseframe Labs.

What to highlight above the fold:
- `projscan start` / `projscan_start`: first-60-seconds repo orientation with setup diagnostics, `firstTenMinutes`, recommended workflow, top risks, adoption gaps, and next commands.
- `projscan understand` / `projscan_understand`: cited repo-comprehension surface with `map`, `flow`, `contracts`, `change`, and `verify` views; file/symbol-backed `claims`, `readFirst`, `unknowns`, change readiness, verification tiers, and exact next commands.
- `projscan semantic-graph` / `projscan_semantic_graph`: stable v3 semantic graph with file, function, package, and symbol nodes plus normalized imports, exports, definitions, and calls edges.
- `projscan dataflow` / `projscan_dataflow`: focused direct, propagated, and bridge source-to-sink risks over the function graph, with Next.js, Express, and Hono request sources, receiver-sensitive DB/write sinks, and opt-ins for test files, broad file IO, and generated/codegen paths.
- `projscan review` / `projscan_review`: one-call PR review now scopes cycles, taint, dataflow, contracts, graph evidence, summaries, and verdicts inside the requested workspace package before verdicting.
- `projscan feedback summary --file .projscan-feedback.json --format json` + `projscan dogfood --repo ../api --repo ../web --repo ../worker --feedback .projscan-feedback.json --format json`: adoption proof loop across real repos with `proofGates`, `nextProofStep`, measured reviewer feedback, repeat-use readiness, MCP readiness, and false-positive tracking.
- `projscan privacy-check`: visible trust report for telemetry status, offline mode, Git ignore handling, ignored-file count, `.env` content scanning, plugin execution, local write surfaces, report-export sensitivity, and known network-capable endpoints.
- `projscan telemetry explain`: transparent default-off telemetry controls for anonymous product-health metrics without source code, paths, repo names, branch names, package names, usernames, raw findings, secrets, or environment values.
- Telemetry endpoint: add/verify `POST /api/projscan/telemetry` on Baseframe Labs to accept `{ schemaVersion: 1, events: [...] }`, discard unknown fields, store only the documented allowlist from TELEMETRY.md, and return 202.
- `projscan init policy --team <team>`: policy starter kits for frontend, platform, security, and monorepo teams.
- `projscan init github-action`: pull-request workflow scaffold that runs projscan, posts PR evidence comments, and fails CI only when preflight returns `block`.
- `projscan init mcp` / `projscan_adoption { action: "mcp_config" }`: ready-to-paste MCP configuration for Claude Desktop, Claude Code, Cursor, Codex, Continue, Windsurf, Cline, Zed, Gemini, or all supported clients.
- `projscan first-run` / `projscan_adoption { action: "first_run" }`: first-run diagnostics across Node.js, package metadata, Git, config, Tree-sitter runtime, plugins, MCP startup, and the shared `firstTenMinutes` path.
- `projscan recipes` / `projscan_adoption { action: "recipes" }`: workflow recipes for team bootstrap, PR automation, before edit, bug hunt, release approval, handoff, and pre-merge.
- `projscan handoff --write docs/agent-handoff.md`: persists a concise next-agent handoff artifact.
- `projscan workplan` / `projscan_workplan`: ordered agent execution plans with evidence, suggested tools, verification commands, and handoff text.
- `projscan bug-hunt` / `projscan_bug_hunt`: prioritized fix queues from doctor, preflight, hotspots, and session signals.
- `projscan agent-brief` / `projscan_agent_brief`: compact context packets for the next agent, including focus items, repo context, coordination hints, guardrails, and next actions.
- `projscan quality-scorecard` / `projscan_quality_scorecard`: dimensioned quality view across health, security, tests, maintainability, coordination, top risks, and commands.
- `projscan preflight` / `projscan_preflight`: one safety gate returning `proceed`, `caution`, or `block`, with release-scale evidence that downgrades scale-only commit readiness to caution while keeping merge sign-off explicit.
- 42 MCP tools for repo understanding, structural code intelligence, semantic graph, dataflow, adoption guidance, and release readiness.
- 11 AST-backed languages: JavaScript, TypeScript, Python, Go, Java, Ruby, Rust, PHP, C#, Kotlin, Swift, and C++.
- Stable local analyzer and reporter plugins, now with `projscan plugin init`, static-by-default `projscan plugin test`, trust-on-first-use execution (`projscan plugin trust` / `untrust`, per-plugin trust status in `plugin list`) on top of `PROJSCAN_PLUGINS_PREVIEW=1`, validation commands, and graph/dataflow context hints.
- Command-dependent output formats: console, json, markdown, sarif, and html.
- Local-first trust boundary: no source upload, no hidden telemetry, no API key. `projscan privacy-check` shows the boundary before scanning; anonymous product telemetry is default-off and only runs after explicit opt-in with `projscan telemetry enable` or the interactive `projscan init team` prompt. MCP workplans cannot enable plugin execution by request argument alone, and cross-repo workspace graph reads only locally registered sibling repos from `.projscan-cache/workspace.json`.

Real proof examples to add:
- Before projscan: a PR review comment that only says "run tests" or dumps scanner output.
- After projscan: a compact PR comment with verdict, actual defects vs manual review, top risks, First Fix, owner routing, baseline trend, and commands like `projscan review --format json`.
- Onboarding flow: `npx projscan init team --team security` creating policy, GitHub Action, CODEOWNERS, baseline memory, and next commands.
- MCP setup proof: `npx projscan mcp doctor --client codex --format json` returning the exact config block to paste.
- Repo understanding proof: `npx projscan understand --view change --intent "rename auth token loader" --format json` returning cited claims, blast radius, rollback, verification commands, and unknowns.
- Calibration proof: docs-only and generated-code PR examples stay calm; dataflow/security PRs show actual defects; large release PRs show manual release sign-off.
- Use the shipped PR comment examples as website source material: docs/examples/pr-comments/docs-only.md, auth-api.md, dataflow-security.md, large-release.md, generated-code.md, actual-3.0.5-pr.md, and before-after.md.
- Link the onboarding proof doc: docs/FIRST-10-MINUTES.md.
- Link the adoption proof loop: docs/ADOPTION-PROOF.md.

Feature sections to update:
- Repo Understanding: `projscan understand` / `projscan_understand` with cited map, flow, contracts, change-readiness, and verification views for working engineers before they edit.
- Deep Graph Platform: stable semantic graph, dataflow risk engine, review-time bridge risk blocking, and public graph/dataflow APIs.
- Adoption Layer: MCP client snippets, team policy starters, PR workflow automation, bootstrap recipes, first-run diagnostics, default-off telemetry controls, dogfood proof across 3+ repos, and repeat-use metrics that make setup obvious in under ten minutes.
- Agent Mission Control: workplans, handoffs, agent briefs, and scorecards that keep long-running agent work coordinated.
- Autonomous Bug Hunt: ranked fix queues with evidence and verification commands.
- Readiness Evidence: product-line planning, approval packets, GitHub PR comment evidence with suggested next actions, block-only PR workflow enforcement, and smoke/focused/full regression matrices.
- Agent Trust: preflight verdicts before edit, commit, and merge; required checks; suggested next tool calls; clearer separation between concrete blockers and scale-only release sign-off.
- Multi-agent coordination: `projscan://session/summary`, `projscan://handoff`, and `projscan://risk-now`, each with `coordinationHints` that separate current worktree checks from remembered session context.
- Deeper review intelligence: package-scoped `contractChanges`, `newTaintFlows`, hardened `newDataflowRisks`, compact package-scoped `graphEvidence`, generated-code review filtering, and preflight `releaseScale` evidence for large platform releases.
- Plugin Platform: analyzer plugins add findings; reporter plugins render doctor, analyze, and ci in a team-specific voice; init/test commands make authoring practical; trust-on-first-use approval gates execution per module; the Plugin Gallery includes policy, team health, security radar, and release-readiness examples.
- Release trust: public stability contract, Node.js >= 18 support, packed-install smoke testing, MCP Registry descriptor validation.
- Screenshots/media: use the latest README media from docs/, especially projscan-reporter-plugin.png/gif, npx projscan --help.gif, and projscan-adoption-loop.gif.

Calls to action:
- "Understand the repo" with npx projscan understand --view map --format json.
- "Trace runtime flow" with npx projscan understand --view flow --format json.
- "Plan a safe change" with npx projscan understand --view change --intent "rename auth token loader" --format json.
- "Build a verification map" with npx projscan understand --view verify --format json.
- "Add projscan to your MCP client" with npx projscan init mcp --client all.
- "Inspect the semantic graph" with npx projscan semantic-graph --format json.
- "Run a dataflow safety pass" with npx projscan dataflow --format json.
- "Run first-run diagnostics" with npx projscan first-run.
- "Prove adoption across real repos" with npx projscan feedback summary --file .projscan-feedback.json --format json, then npx projscan dogfood --repo ../api --repo ../web --repo ../worker --feedback .projscan-feedback.json --format json.
- "Review the privacy boundary" with npx projscan privacy-check --offline.
- "Review the telemetry boundary" with npx projscan telemetry explain.
- "Orient the next workflow" with npx projscan start --format json.
- "Initialize team policy" with npx projscan init policy --team security.
- "Add PR evidence automation" with npx projscan init github-action, highlighting that the generated workflow posts evidence before enforcing block-only failure.
- "Pick an agent workflow" with npx projscan recipes.
- "Plan the next agent pass" with npx projscan workplan --mode bug_hunt --format json.
- "Run a safety preflight" with npx projscan preflight --format json.
- "Generate an agent brief" with npx projscan agent-brief --intent bug_hunt --format json.
- "Review the quality scorecard" with npx projscan quality-scorecard --format json.
- "Run a local health check" with npx projscan doctor.
- "Author a local plugin" linking to docs/PLUGIN-AUTHORING.md.
```

## Market validation proof assets

Use `projscan feedback summary --file .projscan-feedback.json --format json`, then `projscan trial --repo <repo-a> --repo <repo-b> --repo <repo-c> --feedback .projscan-feedback.json --format json` and copy `websiteProof.markdown` into the website update source material. Prefer measured claims such as minutes saved, risky edits prevented, false-positive reports tracked, and real repo count over generic scanner language.
