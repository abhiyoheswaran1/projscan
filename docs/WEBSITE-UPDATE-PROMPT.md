# Website Update Prompt

Use this prompt when updating the public projscan website after the npm, GitHub, and MCP Registry release surfaces are live.

```text
Update the projscan website for projscan 2.8.0 "Agent Mission Control".

Core positioning:
- Name: projscan
- MCP Registry name: io.github.abhiyoheswaran1/projscan
- Registry description: Agent-first code intelligence over MCP. 11 langs, 36 tools, local plugins. Offline.
- One-line homepage copy: Agent-first code intelligence for AI coding agents: workplans, bug-hunt queues, readiness evidence, compact agent briefs, quality scorecards, preflight safety, review intelligence, shared session context, and local team plugins.
- Install: npm install -g projscan
- Run without install: npx projscan
- MCP server command: npx -y projscan mcp
- Requirements: Node.js >= 18

What to highlight above the fold:
- `projscan workplan` / `projscan_workplan`: ordered agent execution plans with evidence, suggested tools, verification commands, and handoff text.
- `projscan bug-hunt` / `projscan_bug_hunt`: prioritized fix queues from doctor, preflight, hotspots, and session signals.
- `projscan agent-brief` / `projscan_agent_brief`: compact context packets for the next agent, including focus items, repo context, guardrails, and next actions.
- `projscan quality-scorecard` / `projscan_quality_scorecard`: dimensioned quality view across health, security, tests, maintainability, coordination, top risks, and commands.
- `projscan preflight` / `projscan_preflight`: one safety gate returning `proceed`, `caution`, or `block`.
- 36 MCP tools for structural code intelligence.
- 11 AST-backed languages: JavaScript, TypeScript, Python, Go, Java, Ruby, Rust, PHP, C#, Kotlin, Swift, and C++.
- Stable local analyzer and reporter plugins, now with `projscan plugin init` and `projscan plugin test`.
- Command-dependent output formats: console, json, markdown, sarif, and html.
- Offline-first behavior: no source upload, no telemetry, no API key.

Feature sections to update:
- Agent Mission Control: workplans, handoffs, agent briefs, and scorecards that keep long-running agent work coordinated.
- Autonomous Bug Hunt: ranked fix queues with evidence and verification commands.
- Readiness Evidence: product-line planning, approval packets, and smoke/focused/full regression matrices.
- Agent Trust: preflight verdicts before edit, commit, and merge; required checks; suggested next tool calls.
- Multi-agent coordination: `projscan://session/summary`, `projscan://handoff`, and `projscan://risk-now`.
- Deeper review intelligence: `contractChanges` for export and package-entrypoint changes.
- Plugin Platform: analyzer plugins add findings; reporter plugins render doctor, analyze, and ci in a team-specific voice; init/test commands make authoring practical.
- Release trust: public stability contract, Node.js >= 18 support, packed-install smoke testing, MCP Registry descriptor validation.
- Screenshots/media: use the latest README media from docs/, especially projscan-reporter-plugin.png/gif and npx projscan --help.gif.

Calls to action:
- "Add projscan to your MCP client" with npx -y projscan mcp.
- "Plan the next agent pass" with npx projscan workplan --mode bug_hunt --format json.
- "Run a safety preflight" with npx projscan preflight --format json.
- "Generate an agent brief" with npx projscan agent-brief --intent bug_hunt --format json.
- "Review the quality scorecard" with npx projscan quality-scorecard --format json.
- "Run a local health check" with npx projscan doctor.
- "Author a local plugin" linking to docs/PLUGIN-AUTHORING.md.
```
