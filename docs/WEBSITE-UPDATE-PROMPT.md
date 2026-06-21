# Website Update Prompt

Use this prompt when updating the public projscan website after the npm,
GitHub, and MCP Registry release surfaces are live.

Current live-site baseline from 2026-06-21; re-check before publishing:

- `https://www.baseframelabs.com/apps/projscan` already shows `4.9.3`, the
  `README And Demo Refresh` story, `45` MCP tools, and the current Mission
  Control media.
- `https://www.baseframelabs.com/apps/projscan/docs` still shows a `Changelog
  4.9.1` nav label and should move to the 4.10.0 story.
- Keep 4.0 migration content and 4.9 trust-patch details as historical context.

```text
Update the projscan website for projscan 4.10.0.

Pages to update:
- https://www.baseframelabs.com/apps/projscan
- https://www.baseframelabs.com/apps/projscan/docs
- The changelog/release-notes surface

Release headline:
4.10.0: Trustworthy Daily Engineering Gates

Primary story:
projscan 4.10.0 turns the 4.9 trust release into a stricter daily engineering
gate. It adds targeted suppressions for known false positives, clearer CI
finding details, score breakdowns, fail-on severity floors, feedback-intake
routing, and a more reliable release test suite. Lead with engineers keeping
the scanner on instead of disabling noisy rules.

Do not change:
- Keep the product name `projscan`.
- Keep the MCP Registry name `io.github.abhiyoheswaran1/projscan`.
- Keep the MCP Registry description aligned with this wording: Agent-first MCP. 11 AST adapters, 12 named languages, 45 tools, mission outcomes. Local.
- Keep requirements copy anchored on Node.js >= 18.
- Keep local-first trust copy precise: core scans run locally by default, source
  is not uploaded, no projscan account or API key is required, telemetry is
  default-off, and network-capable paths are explicit.
- Keep the 45 MCP tools count unless the release artifact says otherwise.
- Describe language support as 11 AST adapters covering 12 named languages.
- Keep Baseframe Labs as the umbrella brand/family only, not a legal company
  name with LLC/corp wording.

Stale live-site claims to update:
- Version labels: `4.0.0`, `4.3.1`, `4.4.0`, `4.7.0`, `4.8.0`, `4.9.0`,
  `4.9.1`, `4.9.2`, or `4.9.3` -> `4.10.0`.
- Navigation/changelog labels: `Changelog 4.0.0`, `Changelog 4.3.1`,
  `Changelog 4.4.0`, `Changelog 4.7.0`, `Changelog 4.8.0`,
  `Changelog 4.9.0`, `Changelog 4.9.1`, `Changelog 4.9.2`, or
  `Changelog 4.9.3` -> `Changelog 4.10.0`.
- Release notes headings: old `Shipped in ...` headings -> `Shipped in 4.10.0.`
- Replace any release-current `4.9.3` copy with the 4.10.0 gate-trust story.

Above-the-fold update:
- Lead with: "Trust the gate. Keep the scanner on."
- Hero command: `npx projscan start --intent "is it safe to commit this change?"`
- Supporting command: `npx projscan ci --format json`
- Mention targeted suppressions, full finding locations, severity floors, and
  score breakdowns near the first proof workflow.
- Keep graph, dataflow, MCP, Mission Control, and local-first language, but make
  trusted daily gates the first story.

New release-note bullets for 4.10.0:
- Targeted suppressions: config-level suppressions and inline ignore directives
  let teams silence one known false positive without excluding a whole file or
  disabling a whole rule.
- Cleaner secret scanning: hardcoded-secret handling distinguishes public
  Firebase web config, secret names, comments, and placeholders from real
  assigned secret values.
- CI details: `projscan ci` and JSON output carry file, line, rule id, severity,
  full message, and remediation data for PR annotations.
- Score clarity: health output includes severity/category score breakdowns.
- Gate tuning: `failOn` severity floors let teams decide whether info-only
  findings can fail a gate.
- First-party lifecycle hygiene: first-party `prepare` scripts no longer look
  like dependency lifecycle risk.
- Cache hygiene: init adds `.projscan-memory/` to `.gitignore`, and read-only
  runs avoid mutating tracked generated source files.
- Feedback intake: install warnings, false positives, docs-overclaim feedback,
  and workflow-focus feedback route to actionable follow-up work.
- Release-suite reliability: oversized router/start tests were split so the
  full `npm run test` gate passes under normal release checks.

Main page feature-section edits:
- Trusted CI gates: show one finding with location, severity, remediation, and
  score impact.
- Suppress one finding: show `// projscan-ignore-line hardcoded-secret -- reason`
  and config-level `suppress` as narrow tools for confirmed false positives.
- Keep signal, cut noise: explain Firebase public web keys, secret-name arrays,
  comments, and placeholders as handled false-positive cases.
- Feedback loop: show `projscan feedback intake --text "<report>" --format json`
  as the path from reviewer feedback to a task.
- Mission Control: keep `projscan start --intent` and saved mission proof as the
  workflow entrypoint.

Docs page updates:
- Add a "Suppress one confirmed finding" section with inline and config examples.
- Add a "Tune CI failure floors" section for `failOn` and severity overrides.
- Add a "Read the score breakdown" section that names base score, final score,
  severity weights, and category penalties.
- Add a "Forward feedback into projscan" section with:
  - `npx projscan feedback intake --text "unused-exports false positive: ..." --format json`
  - `npx projscan feedback intake --file feedback.md --format json`
- Keep the "Start with an intent" and "Resume from mission proof" sections from
  the 4.9 site.

Screenshots/media:
- Use the README media after the `v4.10.0` tag is live:
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.10.0/docs/projscan-mission-control.png`
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.10.0/docs/projscan-proof-router.png`
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.10.0/docs/projscan-mission-control.gif`
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.10.0/docs/projscan-mission-proof.gif`
- Use the Mission Control image as the hero/overview asset.
- Use proof-router imagery for docs or release-note detail.
- Keep older terminal GIFs only as secondary proof.

Calls to action:
- Primary: "Check the gate" -> `npx projscan ci --format json`
- Secondary: "Route a goal" -> `npx projscan start --intent "is it safe to commit this change?"`
- Secondary: "Intake feedback" -> `npx projscan feedback intake --text "<feedback>" --format json`
- Secondary: "Resume from proof" -> `npx projscan start --mission .projscan/mission`
- Keep existing CTAs for MCP setup, privacy-check, evidence-pack, and swarm coordination.

Suggested copy block:
projscan 4.10.0 focuses on gates engineers can keep enabled. It adds narrow
suppressions for confirmed false positives, complete CI finding details, score
breakdowns, severity floors, and feedback intake for reports from real projects.
Core scans still run locally by default, source is not uploaded, and telemetry
stays off until someone opts in.

Verification before publishing:
- Confirm every visible version/changelog label reads 4.10.0.
- Confirm the tool count still reads 45.
- Confirm language copy reads 11 AST adapters covering 12 named languages.
- Confirm `projscan ci --format json` and `projscan start --intent` appear on
  overview and docs pages.
- Confirm suppression, `failOn`, score breakdown, and feedback-intake examples
  appear in docs.
- Confirm the screenshots load from the `v4.10.0` raw GitHub URLs after the tag
  is pushed.
- Search the rendered site for `4.9.3`; remaining hits should be historical
  release context, not current-version labels.
```

## Release Proof Assets

- README screenshots: `docs/projscan-mission-control.png`,
  `docs/projscan-proof-router.png`
- VHS demos: `docs/projscan-mission-control.gif`,
  `docs/projscan-mission-proof.gif`
- Screenshot source: `docs/demos/projscan-4-1-demo.html`
- VHS sources: `docs/demos/projscan-mission-control.tape`,
  `docs/demos/projscan-mission-proof.tape`
- Regenerate screenshots: `npm run docs:screenshots`
- Regenerate VHS demos: `npm run docs:demos`
- Regenerate all README media: `npm run docs:assets`
- Changelog source: `CHANGELOG.md` entry for `4.10.0`
