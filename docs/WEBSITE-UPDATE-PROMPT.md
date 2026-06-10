# Website Update Prompt

Use this prompt when updating the public projscan website after the npm, GitHub, and MCP Registry release surfaces are live.

Current live-site state checked on 2026-06-10:
- `https://www.baseframelabs.com/apps/projscan` shows Version `4.0.0`, `45` MCP tools, the nav label `Changelog 4.0.0`, and a release-notes section headed `Shipped in 4.0.0.`
- `https://www.baseframelabs.com/apps/projscan/docs` still presents `projscan start` as first-60-seconds orientation. It does not yet document `projscan start --intent "<goal>"`, Mission Control execution plans, saved mission bundles, or review gates.
- This update should move the site from the 4.0.0 consolidation story to the 4.2.0 Mission Control handoff story. Keep the 4.0 migration section as historical context.

```text
Update the projscan website for projscan 4.2.0.

Pages to update:
- https://www.baseframelabs.com/apps/projscan
- https://www.baseframelabs.com/apps/projscan/docs
- The changelog/release-notes surface currently labelled "Changelog 4.0.0"

Release headline:
4.2.0: Mission Control Handoffs

Primary story:
projscan now turns a plain-language developer goal into a runnable local mission. A developer or agent can ask what they are trying to do, then get the next command, MCP tool call, proof queue, checklist, review gate, and saved bundle needed to resume or approve the work.

Do not change:
- Keep the product name `projscan`.
- Keep the MCP Registry name `io.github.abhiyoheswaran1/projscan`.
- Keep the MCP Registry description: Agent-first code intelligence over MCP. 11 langs, 45 tools, repo understanding. Local.
- Keep requirements copy anchored on Node.js >= 18.
- Keep the local-first, no source upload, no API key, default-off telemetry positioning.
- Keep the 45 MCP tools count unless the release artifact says otherwise.
- Keep Baseframe Labs as the umbrella brand/family only, not a legal company name with LLC/corp wording.
- Keep 4.0 migration content, but move it below the new 4.2 release story.

Stale live-site claims to update:
- Version: `4.0.0` -> `4.2.0`.
- Navigation/changelog label: `Changelog 4.0.0` -> `Changelog 4.2.0`.
- Release notes heading: `Shipped in 4.0.0.` -> `Shipped in 4.2.0.`
- Replace hero command examples that only show `npx projscan` or `npx projscan start` with `npx projscan start --intent "is it safe to commit this change?"`
- Any docs copy that says `projscan start` only orients a new agent should now say `projscan start --intent "<goal>"` routes a goal into commands, proof, and handoff surfaces.

Above-the-fold update:
- Lead with: "Ask in plain language. Get the next safe command."
- Hero command: `npx projscan start --intent "is it safe to commit this change?"`
- Mention that Mission Control returns inferred workflow mode, route confidence, ready actions, execution plan, current cursor, done criteria, proof commands, review gate, and handoff prompt.
- Keep graph, dataflow, MCP, and local-first language, but make it secondary to the goal-to-proof workflow.

New release-note bullets for 4.2.0:
- Execution plans with a cursor: `projscan start --intent "<goal>"` returns ordered phases, blocked inputs, follow-ups, done criteria, and the current step to run.
- MCP-native next action: `--next-tool-call` returns compact JSON for the current cursor step, and `--ready-tool-calls` returns the current call plus remaining callable proof.
- Copyable shortcuts: `--next-command`, `--proof-commands`, `--checklist`, `--resume-json`, `--handoff-json`, `--task-card`, `--runbook`, `--review-gate`, `--review-gate-json`, `--review-policy`, and `--review-replies`.
- Saved mission bundles: `--save-mission <dir>` writes `README.md`, prompts, runbook, task card, review gate, JSON handoff files, shortcut JSON, `mission.sh`, `status.sh`, `review.sh`, proof logs, run report, summary JSON, and manifest metadata.
- Review gates: Mission Control carries approval policy, worktree evidence, remaining proof, done criteria, reviewer decision options, and copyable replies. Agents know to stop before another slice, release, publish, deploy, push, merge, or version bump.
- Shell-safe handoffs: generated commands and saved mission scripts now escape `$` and backticks in freeform intent text, so copied commands treat developer goals as literal arguments.

Keep the 4.1.0 story as part of the cumulative explanation:
- `projscan start --intent "<goal>"` maps plain-language work to inferred mode, route confidence, matched keywords, ready actions, alternatives, done criteria, proof commands, and handoff prompt.
- Intent routing covers privacy, repo orientation, local setup, change planning, public contracts, file impact, package importers, ownership, PR evidence, release readiness, coordination, and session handoff.
- Proof questions route to targeted verification proof. Failing, flaky, and build questions route to regression planning.
- Local setup discovery includes npm scripts, lint/typecheck, e2e, Storybook, Cypress, Playwright, Docker Compose, migrations, and seed/reset commands.
- Dependency intelligence includes license summary, copyleft risk, installed package sizes, and package importer guidance.

Main page feature-section edits:
- Agent mission control: lead with `projscan start --intent`. Explain that it routes goals such as "safe to commit", "what changed since last release", "where should I put this feature", "what tests should I run", "who owns auth", and "give the next agent a handoff" into concrete commands and proof.
- Runnable handoffs: add a section for saved mission bundles with `mission.sh`, `status.sh`, and `review.sh`. Explain that a sleeping or resumed agent can pick up from the bundle without rereading the full report.
- Review gates: add a section explaining the approval boundary. The tool should help agents stop, report proof, and wait before another slice or release.
- Deep graph platform: keep the 4.0 graph-query story. Add that package importer questions such as "who uses lodash?" can route into semantic-graph package importer lookups.
- Readiness evidence: explain that proof commands now come directly from the developer's intent, not only from preflight/review.
- Release trust: mention there are no tool removals in 4.2.0. This is additive Mission Control surface plus one shell-safety fix.

Docs page updates:
- Add a "Start with an intent" section near "Orient your agent in 60 seconds".
- Include examples:
  - `npx projscan start --intent "is it safe to commit this change?"`
  - `npx projscan start --intent "what tests should I run for my changes?"`
  - `npx projscan start --intent "who imports src/core/start.ts?"`
  - `npx projscan start --intent "what licenses do our dependencies use?"`
  - `npx projscan start --intent "give the next agent a handoff"`
- Add a "Mission handoffs" section with:
  - `npx projscan start --next-command --intent "what breaks if I rename the auth token loader?"`
  - `npx projscan start --next-tool-call --intent "what breaks if I rename the auth token loader?"`
  - `npx projscan start --proof-commands --intent "what breaks if I rename the auth token loader?"`
  - `npx projscan start --save-mission .projscan/mission --intent "what breaks if I rename the auth token loader?"`
  - `cd .projscan/mission && ./mission.sh && ./status.sh && ./review.sh`
- Explain routing behavior briefly:
  - safety questions -> `projscan preflight`
  - repo/change questions -> `projscan understand`
  - import/package questions -> `projscan semantic-graph`
  - PR/release questions -> `projscan evidence-pack`, `review`, or release readiness
  - failing/flaky/build questions -> `projscan regression-plan`
  - proof/testing questions -> `projscan understand --view verify`
- Keep the 4.0 migration section in place, and state that 4.2.0 is additive.

Screenshots/media:
- Use the new README media after the `v4.2.0` tag is live:
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.2.0/docs/projscan-mission-control.png`
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.2.0/docs/projscan-proof-router.png`
- Use the Mission Control image as the hero/overview asset.
- Use the proof-router image for docs or release-note detail.
- Keep older terminal GIFs only as secondary proof.

Calls to action:
- Primary: "Route a goal" -> `npx projscan start --intent "is it safe to commit this change?"`
- Secondary: "Save a mission bundle" -> `npx projscan start --save-mission .projscan/mission --intent "give the next agent a handoff"`
- Secondary: "Get the next MCP call" -> `npx projscan start --next-tool-call --intent "who imports src/core/start.ts?"`
- Secondary: "Build a verification map" -> `npx projscan understand --view verify --format json`
- Keep existing CTAs for MCP setup, privacy-check, evidence-pack, and swarm coordination.

Suggested copy block:
Ask projscan what you are trying to do, not which internal command you remember. In 4.2.0, `projscan start --intent "<goal>"` builds a mission: it explains the route, points at the next command, returns the MCP call, lists the remaining proof, writes a reviewable task card, and can save a runnable bundle with `mission.sh`, `status.sh`, and `review.sh`. It stays local-first: no source upload, no API key, no hidden telemetry.

Verification before publishing:
- Confirm every visible version/changelog label reads 4.2.0.
- Confirm the tool count still reads 45.
- Confirm `projscan start --intent` appears on both overview and docs pages.
- Confirm `--save-mission`, `mission.sh`, `status.sh`, `review.sh`, and `--review-gate` appear in the docs page.
- Confirm the new screenshots load from the `v4.2.0` raw GitHub URLs after the tag is pushed.
- Search the rendered site for `4.0.0`; remaining hits should be only historical migration context, not current-version labels.
```

## Release Proof Assets

- README screenshots: `docs/projscan-mission-control.png`, `docs/projscan-proof-router.png`
- Screenshot source: `docs/demos/projscan-4-1-demo.html`
- Regenerate screenshots: `npm run docs:screenshots`
- Changelog source: `CHANGELOG.md` entry for `4.2.0`
