# Website Update Prompt

Use this prompt when updating the public projscan website after the npm, GitHub, and MCP Registry release surfaces are live.

```text
Update the projscan website for projscan 3.0.2 "Agent Graph Readiness".

Core positioning:
- Name: projscan
- MCP Registry name: io.github.abhiyoheswaran1/projscan
- Registry description: Agent-first code intelligence over MCP. 11 langs, 39 tools, graph evidence, dataflow. Offline.
- One-line homepage copy: Agent-first code intelligence for AI coding agents: stable semantic graph, bridge dataflow risk detection, ready-to-paste MCP setup, workflow recipes, first-run diagnostics, workplans, bug-hunt queues, readiness evidence, compact agent briefs, quality scorecards, preflight safety, review intelligence, shared session context, and local team plugins.
- Install: npm install -g projscan
- Run without install: npx projscan
- MCP server command: npx -y projscan mcp
- Requirements: Node.js >= 18

What to highlight above the fold:
- `projscan semantic-graph` / `projscan_semantic_graph`: stable v3 semantic graph with file, function, package, and symbol nodes plus normalized imports, exports, definitions, and calls edges.
- `projscan dataflow` / `projscan_dataflow`: focused direct, propagated, and bridge source-to-sink risks over the function graph, with opt-ins for test files and broad file IO.
- `projscan review` / `projscan_review`: one-call PR review now blocks new bridge-helper dataflow risks as well as new taint flows.
- `projscan init mcp` / `projscan_adoption { action: "mcp_config" }`: ready-to-paste MCP configuration for Claude Desktop, Claude Code, Cursor, Codex, Continue, Windsurf, Cline, Zed, Gemini, or all supported clients.
- `projscan first-run` / `projscan_adoption { action: "first_run" }`: first-run diagnostics across Node.js, package metadata, Git, config, Tree-sitter runtime, plugins, and MCP startup.
- `projscan recipes` / `projscan_adoption { action: "recipes" }`: workflow recipes for before edit, bug hunt, release approval, handoff, and pre-merge.
- `projscan workplan` / `projscan_workplan`: ordered agent execution plans with evidence, suggested tools, verification commands, and handoff text.
- `projscan bug-hunt` / `projscan_bug_hunt`: prioritized fix queues from doctor, preflight, hotspots, and session signals.
- `projscan agent-brief` / `projscan_agent_brief`: compact context packets for the next agent, including focus items, repo context, guardrails, and next actions.
- `projscan quality-scorecard` / `projscan_quality_scorecard`: dimensioned quality view across health, security, tests, maintainability, coordination, top risks, and commands.
- `projscan preflight` / `projscan_preflight`: one safety gate returning `proceed`, `caution`, or `block`.
- 39 MCP tools for structural code intelligence, semantic graph, dataflow, adoption guidance, and release readiness.
- 11 AST-backed languages: JavaScript, TypeScript, Python, Go, Java, Ruby, Rust, PHP, C#, Kotlin, Swift, and C++.
- Stable local analyzer and reporter plugins, now with `projscan plugin init` and `projscan plugin test`.
- Command-dependent output formats: console, json, markdown, sarif, and html.
- Offline-first behavior: no source upload, no telemetry, no API key.

Feature sections to update:
- Deep Graph Platform: stable semantic graph, dataflow risk engine, review-time bridge risk blocking, and public graph/dataflow APIs.
- Adoption Layer: MCP client snippets, agent workflow recipes, and first-run diagnostics that make setup obvious in under five minutes.
- Agent Mission Control: workplans, handoffs, agent briefs, and scorecards that keep long-running agent work coordinated.
- Autonomous Bug Hunt: ranked fix queues with evidence and verification commands.
- Readiness Evidence: product-line planning, approval packets, and smoke/focused/full regression matrices.
- Agent Trust: preflight verdicts before edit, commit, and merge; required checks; suggested next tool calls.
- Multi-agent coordination: `projscan://session/summary`, `projscan://handoff`, and `projscan://risk-now`.
- Deeper review intelligence: `contractChanges` for export and package-entrypoint changes, `newTaintFlows`, hardened `newDataflowRisks`, compact `graphEvidence`, and preflight `releaseScale` evidence for large platform releases.
- Plugin Platform: analyzer plugins add findings; reporter plugins render doctor, analyze, and ci in a team-specific voice; init/test commands make authoring practical; the Plugin Gallery includes policy, team health, security radar, and release-readiness examples.
- Release trust: public stability contract, Node.js >= 18 support, packed-install smoke testing, MCP Registry descriptor validation.
- Screenshots/media: use the latest README media from docs/, especially projscan-reporter-plugin.png/gif and npx projscan --help.gif.

Calls to action:
- "Add projscan to your MCP client" with npx projscan init mcp --client all.
- "Inspect the semantic graph" with npx projscan semantic-graph --format json.
- "Run a dataflow safety pass" with npx projscan dataflow --format json.
- "Run first-run diagnostics" with npx projscan first-run.
- "Pick an agent workflow" with npx projscan recipes.
- "Plan the next agent pass" with npx projscan workplan --mode bug_hunt --format json.
- "Run a safety preflight" with npx projscan preflight --format json.
- "Generate an agent brief" with npx projscan agent-brief --intent bug_hunt --format json.
- "Review the quality scorecard" with npx projscan quality-scorecard --format json.
- "Run a local health check" with npx projscan doctor.
- "Author a local plugin" linking to docs/PLUGIN-AUTHORING.md.
```
