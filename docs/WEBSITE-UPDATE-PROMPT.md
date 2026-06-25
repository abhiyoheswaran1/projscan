# Website Update Prompt

Use this prompt after `projscan@4.15.0`, GitHub release `v4.15.0`, and MCP
Registry metadata are live.

Pages to update:

- `https://www.baseframelabs.com/apps/projscan`
- `https://www.baseframelabs.com/apps/projscan/docs`

Do not edit:

- `https://www.baseframelabs.com/apps/projscan/changelog`

The changelog updates automatically.

```text
Update the projscan website for projscan 4.15.0.

Pages to update:
- https://www.baseframelabs.com/apps/projscan
- https://www.baseframelabs.com/apps/projscan/docs

Do not edit:
- https://www.baseframelabs.com/apps/projscan/changelog
The changelog updates automatically.

Release headline:
4.15.0: Proof Replay Trust Loop

Primary story:
projscan 4.15.0 strengthens the proof-first workflow for AI-assisted engineering. It keeps the Verified Change Workflow from 4.14.0 and adds richer Proof Replay, Proof Sufficiency, Team Proof Recipes, safer proof artifact handling, and clearer reviewer receipts. Engineers and agents can create a Proof Contract before editing, run or record proof, replay the final changed files, and show reviewers which proof is fresh, missing, stale, weak, or failed.

Above the fold:
- Lead with: "Prove the change stayed inside the contract."
- Hero command: `npx projscan start --intent "is my agent allowed to change billing retry logic?"`
- Contract command: `npx projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json`
- Executed proof command: `npx projscan prove --run -- npm test -- tests/billing/retry.test.ts`
- Receipt command: `npx projscan prove --changed --contract .projscan/proof-contract.json --format markdown`
- Keep Proof Cards nearby: `npx projscan assess --goal "make this repo safer to ship this week"`
- Keep simulator nearby: `npx projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules"`
- Version: `4.15.0`
- MCP tools: `48 MCP tools`
- MCP Registry name: `io.github.abhiyoheswaran1/projscan`
- MCP Registry description: `Agent-first MCP. 11 AST adapters, 12 named languages, 48 tools, mission outcomes. Local.`
- Language support: `11 AST adapters covering 12 named languages`
- Requirements: Node.js >= 18

New release bullets:
- Proof Receipts now include `proofReplay` with replay status, timeline events, `changedAfterProof`, replay command, and a local receipt fingerprint.
- Proof Sufficiency reports whether each `proofRequirements` row has strong, adequate, weak, missing, stale, or failed proof.
- Team Proof Recipes let `.projscanrc.json` add path-matched required commands, required reviewers, and forbidden files for sensitive areas.
- `projscan evidence-pack --pr-comment` includes proof replay, proof sufficiency, recipe gaps, required reviewers, changed-after-proof files, and receipt fingerprints when a Proof Receipt is available.
- Proof Contract and Proof Ledger reads reject symlink escapes.
- Proof logs redact more standalone token and private-key shapes.
- Saved Mission Control scripts reject shell control syntax before running proof commands.
- The proof workflow internals were split into smaller focused helpers with architecture tests, reducing source hotspots without changing the public workflow.
- MCP still exposes `projscan_prove`; MCP can create, replay, and record imported proof. Only CLI `prove --run` executes local commands.

Docs page additions:
- Add "Proof Replay and Sufficiency":
  - `npx projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json`
  - `npx projscan prove --run -- npm test -- tests/billing/retry.test.ts`
  - `npx projscan prove --changed --contract .projscan/proof-contract.json --format markdown`
- Explain that Proof Replay marks proof as passed, missing, failed, partial, or stale.
- Explain that Proof Sufficiency evaluates risk surfaces and recipe requirements, not just command exit codes.
- Add "Team Proof Recipes" with a short `.projscanrc.json` example that includes `proofRecipes`.
- Explain that recipes add required commands, required reviewers, and forbidden drift to Proof Contracts and Proof Receipts.
- Keep Proof Cards, simulate, Mission Control, privacy-check, evidence-pack, and MCP setup as supporting workflows.

Use these release assets:
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.15.0/docs/projscan-mission-control.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.15.0/docs/projscan-proof-router.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.15.0/docs/projscan-proof-cards.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.15.0/docs/projscan-mission-control.gif`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.15.0/docs/projscan-mission-proof.gif`

Suggested copy:
projscan is the local proof layer for AI-assisted software engineering. In 4.15.0, an engineer or agent can save a Proof Contract, run or record the required proof, replay the final diff, and hand reviewers a receipt that shows scope, proof freshness, sufficiency gaps, required reviewers, and changed-after-proof files. Core scans still run locally by default, source is not uploaded, and no projscan account or API key is required.

Publishing checklist:
- Every current-version label reads `4.15.0`.
- Tool count reads `48`.
- Language copy reads `11 AST adapters covering 12 named languages`.
- Overview and docs show `projscan start --intent`, `projscan prove --intent`, `projscan prove --run`, `projscan prove --changed`, `projscan assess --goal`, and `projscan simulate --plan`.
- Proof Replay, Proof Sufficiency, Team Proof Recipes, Proof Ledger freshness, stale proof, failed proof, reviewer decision, changed-after-proof files, and evidence-pack Proof Receipt sections are visible.
- Screenshots load from the `v4.15.0` raw GitHub URLs.
- Search rendered pages for stale current-version labels from `4.9.3` through `4.14.0`; keep those strings only in historical context.
```
