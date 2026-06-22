# Website Update Prompt

Use this prompt when updating the public projscan website after the npm,
GitHub, and MCP Registry release surfaces are live.

Current live-site baseline from 2026-06-22; re-check before publishing:

- `https://www.baseframelabs.com/apps/projscan` shows `4.11.0` in the version
  and changelog label, but still says `45` MCP tools and still centers the
  Mission Control / 4.10.0 trust-gate story.
- `https://www.baseframelabs.com/apps/projscan/docs` shows a `Changelog 4.11.0`
  nav label, but the intro still says `4.10.0` and `45` MCP tools.
- Keep 4.0 migration content and 4.9 trust-patch details as historical context.

```text
Update the projscan website for projscan 4.11.1.

Pages to update:
- https://www.baseframelabs.com/apps/projscan
- https://www.baseframelabs.com/apps/projscan/docs

Release headline:
4.11.1: Proof-First Engineering Command Center

Primary story:
projscan 4.11.1 is the public README and media refresh for the 4.11 proof-first
release. It keeps the `projscan assess` Proof Cards and `projscan simulate
--plan` risk delta story front and center, and adds an immutable Proof Cards
screenshot so engineers can see the exact evidence shape: risk, why it matters,
what to fix first, how to prove it, and whether a proposed refactor is worth
doing before they edit.

Do not change:
- Keep the product name `projscan`.
- Keep the MCP Registry name `io.github.abhiyoheswaran1/projscan`.
- Keep the MCP Registry description aligned with this wording: Agent-first MCP. 11 AST adapters, 12 named languages, 47 tools, mission outcomes. Local.
- Keep requirements copy anchored on Node.js >= 18.
- Keep local-first trust copy precise: core scans run locally by default, source
  is not uploaded, no projscan account or API key is required, telemetry is
  default-off, and network-capable paths are explicit.
- Keep the 47 MCP tools count unless the release artifact says otherwise.
- Describe language support as 11 AST adapters covering 12 named languages.
- Keep Baseframe Labs as the umbrella brand/family only, not a legal company
  name with LLC/corp wording.

Stale live-site claims to update:
- Version labels: `4.0.0`, `4.3.1`, `4.4.0`, `4.7.0`, `4.8.0`, `4.9.0`,
  `4.9.1`, `4.9.2`, `4.9.3`, `4.10.0`, or `4.11.0` -> `4.11.1`.
- Navigation/changelog labels: `Changelog 4.0.0`, `Changelog 4.3.1`,
  `Changelog 4.4.0`, `Changelog 4.7.0`, `Changelog 4.8.0`,
  `Changelog 4.9.0`, `Changelog 4.9.1`, `Changelog 4.9.2`, or
  `Changelog 4.9.3`, `Changelog 4.10.0`, or `Changelog 4.11.0` ->
  `Changelog 4.11.1`.
- Release notes headings: old `Shipped in ...` headings -> `Shipped in 4.11.1.`
- Replace any release-current `4.9.3`, `4.10.0`, or `4.11.0` copy with the
  4.11.1 proof-first story.

Above-the-fold update:
- Lead with: "Know the safest next change before you edit."
- Hero command: `npx projscan assess --goal "make this repo safer to ship this week"`
- Supporting command: `npx projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules"`
- Mention Proof Cards, risk delta, fix-first mode, affected tests, contract
  surfaces, and proof commands near the first proof workflow.
- Keep graph, dataflow, MCP, Mission Control, and local-first language, but make
  proof-first engineering decisions the first story.

New release-note bullets for 4.11.1:
- README media refresh: public README now includes a dedicated Proof Cards
  screenshot for the `projscan assess` and `projscan simulate` workflow.
- Screenshot refresh: Mission Control README media now shows the current
  47-tool MCP surface.
- Proof-first assessment: `projscan assess` answers what is risky, why it is
  risky, what to fix first, what change shape is safest, which tests prove it,
  what risk the fix removes, and whether the repo is ready to ship.
- Proof Cards: each recommendation carries local evidence, impact, safe change
  shape, verification commands, confidence, feedback or suppression path, and
  risk delta.
- Fix-first mode: `projscan assess --mode fix-first` returns one or two trusted
  next actions instead of a laundry list.
- Risk delta simulator: `projscan simulate --plan "<change plan>"` predicts
  likely files, affected tests, contracts, rollout steps, proof commands, and
  before/after risk before editing.
- Agent workflow: MCP now exposes `projscan_assess` and `projscan_simulate`
  through the 47-tool server.
- Simulator bug pass: vague plans no longer inherit confidence from unrelated
  quality or graph evidence, dotfiles no longer match every plan, and likely
  tests prefer direct matches over broad noise.

Main page feature-section edits:
- Proof Cards: show a card with finding, evidence, impact, safe fix shape,
  verification, confidence, and risk delta.
- Fix-first: show `projscan assess --mode fix-first --format markdown` producing
  one or two trusted next actions.
- Simulate before editing: show `projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules"`.
- Trust memory: keep feedback and suppression paths visible as the way to teach
  projscan when a recommendation is wrong.
- Mission Control: keep `projscan start --intent` and saved mission proof as a
  workflow entrypoint, but make `assess` and `simulate` the release headline.

Docs page updates:
- Add a "Proof-first assessment" section with:
  - `npx projscan assess --goal "make this repo safer to ship this week" --format json`
  - `npx projscan assess --mode fix-first --format markdown`
- Add a "Simulate a proposed change" section with:
  - `npx projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules" --format json`
- Explain that `simulate` is read-only and predicts likely files/tests/contracts;
  it does not edit code or execute the plan.
- Keep the "Start with an intent" and "Resume from mission proof" sections from
  the 4.9 site.

Screenshots/media:
- Use the README media after the `v4.11.1` tag is live:
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.11.1/docs/projscan-mission-control.png`
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.11.1/docs/projscan-proof-router.png`
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.11.1/docs/projscan-proof-cards.png`
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.11.1/docs/projscan-mission-control.gif`
  - `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.11.1/docs/projscan-mission-proof.gif`
- Use the Mission Control image as the hero/overview asset.
- Use the Proof Cards image near the 4.11.1 assess/simulate story.
- Use proof-router imagery for Mission Control, saved proof, or release-review detail.
- Keep older terminal GIFs only as secondary proof.

Calls to action:
- Primary: "Assess risk" -> `npx projscan assess --goal "make this repo safer to ship this week"`
- Secondary: "Simulate a change" -> `npx projscan simulate --plan "<change plan>"`
- Secondary: "Route a goal" -> `npx projscan start --intent "is it safe to commit this change?"`
- Secondary: "Intake feedback" -> `npx projscan feedback intake --text "<feedback>" --format json`
- Secondary: "Resume from proof" -> `npx projscan start --mission .projscan/mission`
- Keep existing CTAs for MCP setup, privacy-check, evidence-pack, and swarm coordination.

Suggested copy block:
projscan 4.11.1 is the public README and media refresh for the proof-first
engineering command center release. It makes the Proof Cards workflow visible:
`projscan assess` shows the safest next change, the evidence behind it, and the
commands that prove it; `projscan simulate --plan` predicts likely files, tests,
contracts, rollout steps, and risk delta before anyone edits. Core scans still
run locally by default, source is not uploaded, and telemetry stays off until
someone opts in.

Verification before publishing:
- Confirm every visible version/changelog label reads 4.11.1.
- Confirm the tool count still reads 47.
- Confirm language copy reads 11 AST adapters covering 12 named languages.
- Confirm `projscan assess --goal`, `projscan assess --mode fix-first`, and
  `projscan simulate --plan` appear on overview and docs pages.
- Confirm Proof Cards, risk delta, affected tests, contract surfaces, and
  proof commands are visible in docs.
- Confirm the screenshots load from the `v4.11.1` raw GitHub URLs after the tag
  is pushed.
- Search the rendered site for `4.9.3`, `4.10.0`, and `4.11.0`; remaining hits
  should be historical release context, not current-version labels.
```

## Release Proof Assets

- README screenshots: `docs/projscan-mission-control.png`,
  `docs/projscan-proof-router.png`, `docs/projscan-proof-cards.png`
- VHS demos: `docs/projscan-mission-control.gif`,
  `docs/projscan-mission-proof.gif`
- Screenshot source: `docs/demos/projscan-4-1-demo.html`
- VHS sources: `docs/demos/projscan-mission-control.tape`,
  `docs/demos/projscan-mission-proof.tape`
- Regenerate screenshots: `npm run docs:screenshots`
- Regenerate VHS demos: `npm run docs:demos`
- Regenerate all README media: `npm run docs:assets`
- Changelog source: `CHANGELOG.md` entry for `4.11.1`
