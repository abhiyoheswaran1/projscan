# Website Update Prompt

Use this prompt after `projscan@5.0.3`, GitHub tag `v5.0.3`, and MCP Registry
metadata go live. Do not publish these website changes before that release
exists.

Pages to update:

- `https://www.baseframelabs.com/apps/projscan`
- `https://www.baseframelabs.com/apps/projscan/docs`

Do not edit:

- `https://www.baseframelabs.com/apps/projscan/changelog`

The website pulls changelog content from release data.

```text
Update the projscan website for projscan 5.0.3.

Pages to update:
- https://www.baseframelabs.com/apps/projscan
- https://www.baseframelabs.com/apps/projscan/docs

Do not edit:
- https://www.baseframelabs.com/apps/projscan/changelog
The website pulls changelog content from release data.

Release headline:
5.0.3: Dead-code analysis reads Astro, Vue, and Svelte imports

Primary story:
projscan 5.0.3 fixes a dead-code false positive on single-file-component projects. The unused-exports analyzer built its import graph from a fixed extension allowlist that excluded `.astro`, `.vue`, and `.svelte`, so a module imported only from Astro frontmatter or a Vue/Svelte `<script>` block read as orphaned and was reported as dead. A new component adapter parses those script regions and feeds their imports into the shared code graph, which also makes single-file-component imports visible to `impact`, `coupling`, `hotspots`, and `search`; the component files themselves are never flagged. This release also makes the analyzer honest about its own coverage: because "nothing imports this file" is only sound when every importer was parsed, dead-code findings now name any code the analyzer could not parse when that code could plausibly import the file, and stay unqualified when coverage is complete. The 5.0.0 review loops are unchanged: `proof-broker` and `review-gate` mint the next scoped Proof Contract only when `--bootstrap-contract` is requested, review stays local, and MCP continues to return evidence without executing proof.

Above the fold:
- Lead with: "ProjScan tells reviewers when to bootstrap, prove, or stop."
- Review Gate bootstrap command: `npx projscan review-gate --intent "is my agent allowed to change billing retry logic?" --bootstrap-contract --pr-comment`
- CI gate command: `npx projscan review-gate --contract .projscan/proof-contract.json --ci --fail-on-needs-proof`
- Proof Broker bootstrap command: `npx projscan proof-broker --intent "is my agent allowed to change billing retry logic?" --bootstrap-contract --pr-comment`
- Proof Broker command: `npx projscan proof-broker --contract .projscan/proof-contract.json --pr-comment`
- Passport command: `npx projscan passport --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json --output .projscan/passport.json`
- Guard command: `npx projscan guard --contract .projscan/proof-contract.json --watch`
- Passport screenshot: `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-agent-change-passport.png`
- Guard screenshot: `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-live-guard.png`
- Review Gate artifact: `.projscan/review-gate.json`
- Passport artifact: `.projscan/passport.json`
- Proof Contract command: `npx projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json`
- Executed proof command: `npx projscan prove --run -- npm test -- tests/billing/retry.test.ts`
- Receipt command: `npx projscan prove --changed --contract .projscan/proof-contract.json --format markdown`
- Keep Proof Cards nearby: `npx projscan assess --goal "make this repo safer to ship this week"`
- Keep simulator nearby: `npx projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules"`
- Version: `5.0.3`
- MCP tools: `51 MCP tools`
- MCP Registry name: `io.github.abhiyoheswaran1/projscan`
- MCP Registry description: `Agent-first MCP. 11 AST adapters, 12 named languages, 51 tools, mission outcomes. Local.`
- Language support: `11 AST adapters covering 12 named languages`
- Requirements: Node.js >= 18

New release bullets:
- Dead-code analysis now parses `.astro`, `.vue`, and `.svelte` script regions (Astro frontmatter and Vue/Svelte `<script>` blocks) when building its import graph, so a module imported only from a single-file component is no longer reported as having unused exports.
- Single-file-component imports feed the shared code graph, so `impact`, `coupling`, `hotspots`, and `search` see `.astro`, `.vue`, and `.svelte` imports; the component files themselves are never flagged as dead.
- Dead-code findings append a coverage caveat that names code the analyzer could not parse when that code could import the flagged file, so "nothing imports this file" is not asserted when reachability could not be fully determined; findings stay unqualified when coverage is complete.
- Proof Receipts still classify sibling Baseframe harness writes (`.agentloop/`, `.agentflight/`) as informational harness evidence, and Proof Ledger matching still normalizes package-runner prefixes (`npx`, `npm exec`, `pnpm exec`/`dlx`, `yarn exec`/`dlx`, `bunx`, `node_modules/.bin`).
- `projscan proof-broker --intent <text> --bootstrap-contract` writes the next scoped Proof Contract only when explicitly requested and returns bootstrap-aware PR Passport output.
- `projscan review-gate --intent <text> --bootstrap-contract` writes the next scoped Proof Contract only when explicitly requested and returns bootstrap-aware reviewer guidance.
- `projscan review-gate --contract .projscan/proof-contract.json --pr-comment` prints Review Gate Markdown for a pull request comment.
- `projscan review-gate --contract .projscan/proof-contract.json --ci --fail-on-needs-proof` prints a compact CI summary and exits non-zero until the gate is `ready`.
- Review Gate Markdown includes status, allow-review decision, reviewer action, proof debt, recontract guidance, bootstrap status when present, required reviewers, next commands, and artifact paths.
- JSON output includes `kind: "review-gate"`, `decision`, `proofDebt`, `recontract`, `bootstrap`, `requiredReviewers`, `nextCommands`, `prComment`, artifacts, and the embedded Proof Broker report.
- ProjScan writes Review Gate artifacts to `.projscan/review-gate.json` or `.projscan/review-gates/<name>.json`; it rejects traversal, symlink targets, non-JSON files, and existing files that are not Review Gate artifacts.
- MCP exposes `projscan_review_gate`, bringing the tool count to 51. The MCP tool returns gate evidence and does not run local proof commands.
- The package exports `computeReviewGate()` plus Review Gate report, decision, proof-debt, recontract, artifact, and PR-comment types.
- Existing proof workflows remain independent: Proof Broker, Agent Change Passport, Live Guard, Proof Ledger, Proof Replay, Proof Sufficiency, Team Proof Recipes, stale proof, failed proof, changed-after-proof files, and evidence-pack Proof Receipt sections still work.
- MCP still exposes `projscan_prove`; MCP can create, replay, and record imported proof. CLI `prove --run` executes local commands.

Docs page additions:
- Add "Review Gate":
  - `npx projscan review-gate --intent "is my agent allowed to change billing retry logic?" --bootstrap-contract --format json`
  - `npx projscan review-gate --contract .projscan/proof-contract.json --pr-comment`
  - `npx projscan review-gate --contract .projscan/proof-contract.json --ci --fail-on-needs-proof`
  - Explain status values: ready, needs-proof, drifted, blocked.
  - Explain proof debt states: missing-contract, scope-drift, missing-proof, failed-proof, stale-proof, weak-proof, recipe-gap.
  - Explain reviewer actions: review, run-proof, rerun-proof, stop-and-recontract.
  - Explain that bootstrap is explicit and Review Gate does not run proof commands.
- Keep "Proof Broker and PR Passport":
  - `npx projscan proof-broker --intent "is my agent allowed to change billing retry logic?" --bootstrap-contract --format json`
  - `npx projscan proof-broker --contract .projscan/proof-contract.json --pr-comment`
  - Explain that Proof Broker reads the Agent Change Passport, can mint the next contract only when explicitly asked, and does not run proof commands.
- Keep "Agent Change Passport":
  - `npx projscan passport --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json --output .projscan/passport.json`
  - `.projscan/passport.json`
- Keep "Live Guard":
  - `npx projscan guard --contract .projscan/proof-contract.json`
  - `npx projscan guard --contract .projscan/proof-contract.json --watch`
  - `npx projscan guard --contract .projscan/proof-contract.json --fail-on-drift`
  - Explain clear, attention, drift, and blocked states.
- Keep "Baseframe Suite Integration v1":
  - `npx projscan assess --intent "Implement password reset" --task-id auth-password-reset-20260627-01 --emit-baseframe`
  - `npx projscan passport --intent "Implement password reset" --task-id auth-password-reset-20260627-01 --emit-baseframe`
  - `.baseframe/evidence/<task-id>/projscan-assessment.json`
  - `.baseframe/agent-workflow.json`
  - Explain that ProjScan owns `projscan-assessment.json`, the passport artifact, and the shared workflow manifest fields it updates.
  - Explain that AgentLoopKit and AgentFlight consume those local artifacts in later steps.

Assets to keep in the gallery until new Review Gate captures land:
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-agent-change-passport.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-live-guard.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-mission-control.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-proof-router.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-proof-cards.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-mission-control.gif`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-mission-proof.gif`

Short product description:
projscan is the local proof layer for AI-assisted software engineering. Review Gate combines contract, passport, broker, receipt, replay, sufficiency, and recipe evidence into one reviewer-readiness decision. It shows whether review can proceed, which proof debt remains, who must review, which command to run next, and whether the agent must stop and recontract. ProjScan keeps source local, users need no ProjScan account or API key, and MCP returns evidence without executing proof commands.

Acceptance checks:
- Every current-version label reads `5.0.3`.
- MCP count reads `51 MCP tools`.
- Overview and docs show `projscan review-gate --intent`, `projscan review-gate --contract`, `projscan review-gate --ci`, `projscan proof-broker --contract`, `projscan passport --intent`, `projscan guard --contract`, `projscan prove --intent`, `projscan prove --run`, `projscan prove --changed`, `projscan assess --goal`, and `projscan simulate --plan`.
- Show Review Gate status, allow-review decision, proof debt, recontract guidance, required reviewers, artifact path, proof replay, Proof Sufficiency, guard status, and MCP non-execution.
- Screenshots load from the listed raw GitHub URLs.
- The copy does not claim hosted scanning, remote code upload, autonomous merging, release automation, or cloud approval.
```
