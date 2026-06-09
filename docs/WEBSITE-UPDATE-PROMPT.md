# Website Update Prompt

Use this prompt when updating the public projscan website after the npm, GitHub, and MCP Registry release surfaces are live.

Current state checked on 2026-06-09:
- `https://www.baseframelabs.com/apps/projscan` is already updated for 4.0.0, shows Version 4.0.0, 45 MCP tools, and a "Shipped in 4.0.0" release-notes section.
- `https://www.baseframelabs.com/apps/projscan/docs` is already updated for 4.0.0, includes the 45-tool docs positioning, semantic-graph query mode, 3.x migration guidance, and swarm coordination docs.
- This update should be a focused 4.1.0 layer on top of the current 4.0.0 site, not a rewrite of the 4.0 consolidation story.

```text
Update the projscan website for projscan 4.1.0.

Pages to update:
- https://www.baseframelabs.com/apps/projscan
- https://www.baseframelabs.com/apps/projscan/docs
- The changelog/release-notes surface currently labelled "Changelog 4.0.0"

Release headline:
4.1.0 — "Mission Control"

Primary story:
projscan now turns a plain-language developer goal into the right local command, proof plan, and next action. It is no longer just a repo intelligence surface an agent can query; it is a first-minute Mission Control layer for deciding what to do next.

Do not change:
- Keep the product name `projscan`.
- Keep the MCP Registry name `io.github.abhiyoheswaran1/projscan`.
- Keep the MCP Registry description: Agent-first code intelligence over MCP. 11 langs, 45 tools, repo understanding. Local.
- Keep requirements copy anchored on Node.js >= 18.
- Keep the local-first/no source upload/no API key/default-off telemetry positioning.
- Keep the 45 MCP tool count unless the release artifact says otherwise.
- Keep the 4.0 consolidation/migration content, but demote it below the new 4.1 release story.
- Keep Baseframe Labs as the umbrella brand/family only, not a legal company name with LLC/corp wording.

Stale live-site claims to update:
- Version: 4.0.0 -> 4.1.0.
- Navigation/changelog label: "Changelog 4.0.0" -> "Changelog 4.1.0".
- Release notes heading: "Shipped in 4.0.0." -> "Shipped in 4.1.0."
- Any hero or docs copy that says `projscan start` is only first-60-seconds orientation should now mention `projscan start --intent "<goal>"` as the Mission Control entry point.

Above-the-fold update:
- Add `projscan start --intent "is it safe to commit this change?"` as the hero command or a prominent command example.
- Position the value as: "Ask in plain language. Get the right local proof."
- Mention that Mission Control returns inferred workflow mode, route confidence, matched keywords, ready actions, done criteria, proof commands, and a handoff prompt.
- Keep the current graph/dataflow/MCP/local-first language, but make it secondary to the new goal-to-proof workflow.

New release-note bullets for 4.1.0:
- Mission Control for real developer goals: `projscan start --intent "<goal>"` maps plain-language work to inferred mode, route confidence, ready actions, alternatives, done criteria, proof commands, and a compact handoff prompt.
- Broader intent routing: privacy, repo orientation, local setup, change planning, public contracts, file impact, package importers, ownership, PR evidence, release readiness, coordination, and session handoff now route to specific commands instead of generic next steps.
- Proof-first verification: "which tests should I run?" and "what proves this works?" route to targeted verification proof, while failing/flaky/build questions still route to focused regression planning.
- Local setup discovery: npm scripts, lint/typecheck, e2e, Storybook, Cypress, Playwright, Docker Compose, migrations, and seed/reset commands are surfaced where agents need them.
- Dependency intelligence: dependency reports now include license summary, copyleft risk, installed package sizes, and package importer guidance.
- Agent reliability: Project Memory recording and MCP close teardown now await async writes/cleanup to reduce session-context races.

Main page feature-section edits:
- Agent mission control: lead with `projscan start --intent`. Explain that it routes "safe to commit", "what changed since last release", "where should I put this feature", "what tests should I run", "who owns auth", and "give the next agent a handoff" into concrete commands and proof.
- Deep graph platform: keep the existing 4.0 graph-query story, and add that targeted package importer questions such as "who uses lodash?" can route into semantic-graph package importer lookups.
- Readiness evidence: add that proof commands are now suggested directly from the developer's intent, not only from preflight/review.
- Release trust: mention the stable-surface check allowed only the additive MCP argument `intent` on `projscan_start`; no tool removals or breaking schema changes in 4.1.0.

Docs page updates:
- Add a short "Start with an intent" section near "Orient your agent in 60 seconds".
- Include examples:
  - `npx projscan start --intent "is it safe to commit this change?"`
  - `npx projscan start --intent "what tests should I run for my changes?"`
  - `npx projscan start --intent "who imports src/core/start.ts?"`
  - `npx projscan start --intent "what licenses do our dependencies use?"`
  - `npx projscan start --intent "give the next agent a handoff"`
- Explain routing behavior briefly:
  - safety questions -> `projscan preflight`
  - repo/change questions -> `projscan understand`
  - import/package questions -> `projscan semantic-graph`
  - PR/release questions -> `projscan evidence-pack`, `review`, or release readiness
  - failing/flaky/build questions -> `projscan regression-plan`
  - proof/testing questions -> `projscan understand --view verify`
- Keep the 4.0 migration section in place, but make clear that 4.1.0 is additive.

Screenshots/media:
- Use the new README media after the `v4.1.0` tag is live:
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.1.0/docs/projscan-mission-control.png`
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.1.0/docs/projscan-proof-router.png`
- The Mission Control image is the best hero/overview asset.
- The proof-router image is best for the docs page or release-notes detail.
- Keep older terminal GIFs only as secondary proof; do not let them displace the new 4.1 Mission Control visuals.

Calls to action:
- Primary: "Route a goal" -> `npx projscan start --intent "is it safe to commit this change?"`
- Secondary: "Build a verification map" -> `npx projscan understand --view verify --format json`
- Secondary: "Trace impact" -> `npx projscan semantic-graph --query importers --file src/auth/token.ts --format json`
- Secondary: "Check dependency licenses" -> `npx projscan dependencies --format json`
- Keep existing CTAs for MCP setup, privacy-check, evidence-pack, and swarm coordination.

Suggested copy block:
Ask projscan what you are trying to do, not which internal command you remember. In 4.1.0, `projscan start --intent "<goal>"` infers the workflow, explains the route, lists ready actions, defines done criteria, and gives the proof commands an agent or reviewer can trust. It stays local-first: no source upload, no API key, no hidden telemetry.

Verification before publishing:
- Confirm every visible version/changelog label reads 4.1.0.
- Confirm the tool count still reads 45.
- Confirm `projscan start --intent` appears on both overview and docs pages.
- Confirm the new screenshots load from the `v4.1.0` raw GitHub URLs after the tag is pushed.
- Search the rendered site for "4.0.0"; remaining hits should be only historical migration/release context, not current-version labels.
```

## Release Proof Assets

- README screenshots: `docs/projscan-mission-control.png`, `docs/projscan-proof-router.png`
- Screenshot source: `docs/demos/projscan-4-1-demo.html`
- Regenerate screenshots: `npm run docs:screenshots`
- Changelog source: `CHANGELOG.md` entry for `4.1.0`
