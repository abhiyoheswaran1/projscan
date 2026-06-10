# Website Update Prompt

Use this prompt when updating the public projscan website after the npm, GitHub, and MCP Registry release surfaces are live.

Current live-site state checked on 2026-06-10:
- `https://www.baseframelabs.com/apps/projscan` still shows Version `4.0.0`, `45` MCP tools, the nav label `Changelog 4.0.0`, and a release-notes section headed `Shipped in 4.0.0.`
- `https://www.baseframelabs.com/apps/projscan/docs` does not yet document Mission Control outcome resume, local proof summaries, or `projscan mission-proof`.
- This update should move the site from the 4.0.0 consolidation story to the 4.3.1 Mission Proof Polish story. Keep the 4.0 migration section as historical context.

```text
Update the projscan website for projscan 4.3.1.

Pages to update:
- https://www.baseframelabs.com/apps/projscan
- https://www.baseframelabs.com/apps/projscan/docs
- The changelog/release-notes surface currently labelled "Changelog 4.0.0"

Release headline:
4.3.1: Mission Proof Polish

Primary story:
projscan now closes the loop after an agent runs a Mission Control bundle and makes that proof easy to review. A developer or agent can save a mission, run local proof, resume from the saved proof state, list saved bundles, write proof artifacts, and decide whether the work is ready for version review.

Do not change:
- Keep the product name `projscan`.
- Keep the MCP Registry name `io.github.abhiyoheswaran1/projscan`.
- Keep the MCP Registry description aligned with this wording: Agent-first MCP. 11 AST adapters, 12 named languages, 45 tools, mission outcomes. Local.
- Keep requirements copy anchored on Node.js >= 18.
- Keep the local-first, no source upload, no API key, default-off telemetry positioning.
- Keep the 45 MCP tools count unless the release artifact says otherwise.
- Describe language support as 11 AST adapters covering 12 named languages.
- Keep Baseframe Labs as the umbrella brand/family only, not a legal company name with LLC/corp wording.
- Keep 4.0 migration content, but move it below the new 4.3 release story.

Stale live-site claims to update:
- Version: `4.0.0` or `4.3.0` -> `4.3.1`.
- Navigation/changelog label: `Changelog 4.0.0` or `Changelog 4.3.0` -> `Changelog 4.3.1`.
- Release notes heading: `Shipped in 4.0.0.` or `Shipped in 4.3.0.` -> `Shipped in 4.3.1.`
- Replace hero command examples that only show `npx projscan` or `npx projscan start` with `npx projscan start --intent "is it safe to commit this change?"`.
- Add `npx projscan start --mission .projscan/mission` anywhere the page talks about resuming saved work.
- Add `npx projscan mission-proof --mission .projscan/mission --format json` anywhere the page talks about measuring proof or adoption.

Above-the-fold update:
- Lead with: "Ask in plain language. Resume from proof."
- Hero command: `npx projscan start --intent "is it safe to commit this change?"`
- Supporting command: `npx projscan start --mission .projscan/mission`
- Mention that Mission Control returns inferred workflow mode, route confidence, ready actions, execution plan, current cursor, done criteria, proof commands, review gate, handoff prompt, and outcome summary.
- Keep graph, dataflow, MCP, and local-first language, but make the goal-to-proof workflow the first story.

New release-note bullets for 4.3.1:
- Mission outcome resume: `projscan start --mission <dir>` reads `proof-logs/summary.json`, `proof-logs/status.jsonl`, and local review decisions from a saved mission bundle.
- Proof-to-review summary: the start report now includes status, command counts, failed command details, reruns, what changed, what remains, and a version-candidate recommendation.
- Local adoption proof: `projscan mission-proof --mission <dir> --format json` summarizes one or more bundles and can compare them with a local manual-run baseline.
- Mission Proof triage: `--latest`, `--all`, `--list`, `--needs-attention`, `--mission-status`, `--summary`, `--require-passed`, and `--write` turn saved mission bundles into local release-review artifacts.
- Reproducible demo media: `npm run docs:demos` renders checked-in VHS demos, and `npm run docs:assets` refreshes screenshots and GIFs together.
- Public count cleanup: website, README, and MCP Registry copy should all say 11 AST adapters covering 12 named languages and 45 MCP tools.

Keep the Mission Control handoff story as cumulative context:
- `projscan start --intent "<goal>"` maps plain-language work to inferred mode, route confidence, matched keywords, ready actions, alternatives, done criteria, proof commands, and handoff prompt.
- Saved mission bundles include `mission.sh`, `status.sh`, `review.sh`, quick commands, prompts, runbook, task card, review gate, JSON handoff files, proof logs, run report, summary JSON, and manifest metadata.
- Review gates carry approval policy, worktree evidence, remaining proof, done criteria, reviewer decision options, and copyable replies.
- Agents should stop before another slice, release, publish, deploy, push, merge, or version bump unless the reviewer approves it.

Main page feature-section edits:
- Agent mission control: lead with `projscan start --intent`. Show how a goal becomes a command, proof queue, and review boundary.
- Resume from proof: add a section for `projscan start --mission .projscan/mission`. Explain that resumed agents start from the saved pass/fail state instead of rereading the full report.
- Local proof report: add a section for `projscan mission-proof`. Explain that it reports proof completion, reviewer approvals, reruns, failed gates, time saved, and risk avoided from local files only.
- Deep graph platform: keep the graph-query story. Add that package importer questions such as "who uses lodash?" can route into semantic-graph package importer lookups.
- Release trust: mention there are no MCP tool removals in 4.3.1. This release adds CLI, docs, and media surfaces around Mission Control proof.

Docs page updates:
- Add a "Start with an intent" section near "Orient your agent in 60 seconds".
- Add a "Resume from mission proof" section with:
  - `npx projscan start --save-mission .projscan/mission --intent "what breaks if I rename the auth token loader?"`
  - `cd .projscan/mission && ./mission.sh && ./status.sh && ./review.sh`
  - `npx projscan start --mission .projscan/mission`
  - `npx projscan mission-proof --mission .projscan/mission --format json`
- Add a "Compare with local manual baseline" section for:
  - `npx projscan mission-proof --mission .projscan/mission --baseline manual-runs.json --format json`
- Explain that the baseline stays local and may include minutes spent, reruns, failed gates, and reviewer approvals.
- Keep the 4.0 migration section in place, and state that 4.3.1 is additive.

Screenshots/media:
- Use the README media after the `v4.3.1` tag is live:
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.3.1/docs/projscan-mission-control.png`
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.3.1/docs/projscan-proof-router.png`
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.3.1/docs/projscan-mission-control.gif`
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.3.1/docs/projscan-mission-proof.gif`
- Use the Mission Control image as the hero/overview asset.
- Use the proof-router image for docs or release-note detail.
- Use the VHS GIFs when the page needs live terminal proof of the Mission Control and Mission Proof flows.
- Keep older terminal GIFs only as secondary proof.

Calls to action:
- Primary: "Route a goal" -> `npx projscan start --intent "is it safe to commit this change?"`
- Secondary: "Resume from proof" -> `npx projscan start --mission .projscan/mission`
- Secondary: "Measure Mission Control proof" -> `npx projscan mission-proof --mission .projscan/mission --format json`
- Secondary: "Save a mission bundle" -> `npx projscan start --save-mission .projscan/mission --intent "give the next agent a handoff"`
- Keep existing CTAs for MCP setup, privacy-check, evidence-pack, and swarm coordination.

Suggested copy block:
Ask projscan what you are trying to do, then keep the proof with the work. In 4.3.1, `projscan start --intent "<goal>"` builds a mission, `--save-mission` writes the runnable bundle, and `projscan start --mission .projscan/mission` resumes from the latest local proof state. `projscan mission-proof` summarizes pass/fail evidence, reviewer decisions, reruns, failed gates, optional local baseline savings, and saved mission bundles. It stays local-first: no source upload, no API key, no hidden telemetry.

Verification before publishing:
- Confirm every visible version/changelog label reads 4.3.1.
- Confirm the tool count still reads 45.
- Confirm language copy reads 11 AST adapters covering 12 named languages.
- Confirm `projscan start --intent` appears on both overview and docs pages.
- Confirm `--save-mission`, `--mission`, `mission.sh`, `status.sh`, `review.sh`, `--review-gate`, and `mission-proof` appear in the docs page.
- Confirm the screenshots load from the `v4.3.1` raw GitHub URLs after the tag is pushed.
- Search the rendered site for `4.0.0`; remaining hits should be only historical migration context, not current-version labels.
```

## Release Proof Assets

- README screenshots: `docs/projscan-mission-control.png`, `docs/projscan-proof-router.png`
- VHS demos: `docs/projscan-mission-control.gif`, `docs/projscan-mission-proof.gif`
- Screenshot source: `docs/demos/projscan-4-1-demo.html`
- VHS sources: `docs/demos/projscan-mission-control.tape`, `docs/demos/projscan-mission-proof.tape`
- Regenerate screenshots: `npm run docs:screenshots`
- Regenerate VHS demos: `npm run docs:demos`
- Regenerate all README media: `npm run docs:assets`
- Changelog source: `CHANGELOG.md` entry for `4.3.1`
