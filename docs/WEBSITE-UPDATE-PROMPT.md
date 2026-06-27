# Website Update Prompt

Use this prompt after `projscan@4.17.0`, GitHub release `v4.17.0`, and MCP
Registry metadata are live.

Pages to update:

- `https://www.baseframelabs.com/apps/projscan`
- `https://www.baseframelabs.com/apps/projscan/docs`

Do not edit:

- `https://www.baseframelabs.com/apps/projscan/changelog`

The changelog updates from release data.

```text
Update the projscan website for projscan 4.17.0.

Pages to update:
- https://www.baseframelabs.com/apps/projscan
- https://www.baseframelabs.com/apps/projscan/docs

Do not edit:
- https://www.baseframelabs.com/apps/projscan/changelog
The changelog updates from release data.

Release headline:
4.17.0: Agent Change Passport and Live Guard

Primary story:
projscan 4.17.0 turns Proof Contracts and Proof Receipts into one local Agent Change Passport. Reviewers see the approved boundary, changed files, proof replay, Proof Sufficiency, stale or missing proof, reviewer action, and next commands before approving an agent handoff. `projscan guard` checks the current working tree against a saved contract and can poll during an agent session. Source stays local, MCP exposes evidence through `projscan_passport`, and proof execution stays in the CLI `prove --run` path.

Above the fold:
- Lead with: "ProjScan turns an AI code change into a local proof passport."
- Passport command: `npx projscan passport --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json --output .projscan/passport.json`
- Guard command: `npx projscan guard --contract .projscan/proof-contract.json --watch`
- Passport artifact: `.projscan/passport.json`
- Proof Contract command: `npx projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json`
- Executed proof command: `npx projscan prove --run -- npm test -- tests/billing/retry.test.ts`
- Receipt command: `npx projscan prove --changed --contract .projscan/proof-contract.json --format markdown`
- Baseframe command: `npx projscan passport --intent "Implement password reset" --task-id auth-password-reset-20260627-01 --emit-baseframe`
- Assessment artifact: `.baseframe/evidence/<task-id>/projscan-assessment.json`
- Workflow manifest: `.baseframe/agent-workflow.json`
- Keep Proof Cards nearby: `npx projscan assess --goal "make this repo safer to ship this week"`
- Keep simulator nearby: `npx projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules"`
- Version: `4.17.0`
- MCP tools: `49 MCP tools`
- MCP Registry name: `io.github.abhiyoheswaran1/projscan`
- MCP Registry description: `Agent-first MCP. 11 AST adapters, 12 named languages, 49 tools, mission outcomes. Local.`
- Language support: `11 AST adapters covering 12 named languages`
- Requirements: Node.js >= 18

New release bullets:
- `projscan passport --intent <text> --save-contract .projscan/proof-contract.json` creates a Proof Contract and evaluates the current working tree in one command.
- `projscan passport --contract .projscan/proof-contract.json --output .projscan/passport.json` writes a local Agent Change Passport JSON artifact.
- Passport JSON includes `schemaVersion`, `kind`, generation time, status, intent, approved boundary, changed files, proof replay, Proof Sufficiency, reviewer decision, reviewer action, next commands, warnings, artifacts, optional Baseframe paths, and the underlying proof contract and receipt.
- Passport writes are local, atomic, restricted to `.projscan/passport.json` or `.projscan/passports/<name>.json`, and protected against traversal, symlink output paths, and unrelated-file overwrites.
- `projscan guard --contract .projscan/proof-contract.json` reports `clear`, `attention`, `drift`, or `blocked` for the current working tree.
- `projscan guard --contract .projscan/proof-contract.json --watch` polls during an agent session without mutating files or running proof commands.
- `projscan guard --fail-on-drift` exits non-zero when the current diff leaves the approved boundary or the contract is missing.
- MCP exposes `projscan_passport`, bringing the tool count to 49. The MCP tool returns passport evidence and does not run local proof commands.
- The package exports `computePassport()` and `computeGuard()` plus Agent Change Passport and guard report types.
- Passport can attach Baseframe assessment evidence with `--task-id <id> --emit-baseframe`; ProjScan limits writes to its own assessment and the shared workflow manifest.
- Existing proof workflows remain independent: Proof Replay, Proof Sufficiency, Team Proof Recipes, Proof Ledger freshness, stale proof, failed proof, reviewer decision, changed-after-proof files, and evidence-pack Proof Receipt sections still work.
- MCP still exposes `projscan_prove`; MCP can create, replay, and record imported proof. CLI `prove --run` executes local commands.

Docs page additions:
- Add "Agent Change Passport":
  - `npx projscan passport --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json --output .projscan/passport.json`
  - `.projscan/passport.json`
  - Explain status values: ready, needs-proof, drifted, blocked.
  - Explain reviewer actions: review, run-proof, rerun-proof, stop-and-recontract.
- Add "Live Guard":
  - `npx projscan guard --contract .projscan/proof-contract.json`
  - `npx projscan guard --contract .projscan/proof-contract.json --watch`
  - `npx projscan guard --contract .projscan/proof-contract.json --fail-on-drift`
  - Explain clear, attention, drift, and blocked states.
- Keep "Baseframe Suite Integration v1":
  - `npx projscan passport --intent "Implement password reset" --task-id auth-password-reset-20260627-01 --emit-baseframe`
  - `.baseframe/evidence/<task-id>/projscan-assessment.json`
  - `.baseframe/agent-workflow.json`
- Explain that ProjScan owns `projscan-assessment.json`, the passport artifact, and the shared workflow manifest fields it updates.
- Explain that AgentLoopKit reads the assessment and writes `agentloopkit-task.json` separately.
- Explain that AgentFlight reads both later and writes `agentflight-result.json` separately.
- Mention task IDs are supplied by the caller, filesystem-safe, and shared across the three tools.
- Keep Proof Replay and Sufficiency:
  - `npx projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json`
  - `npx projscan prove --run -- npm test -- tests/billing/retry.test.ts`
  - `npx projscan prove --changed --contract .projscan/proof-contract.json --format markdown`
- Keep Proof Cards, simulate, Mission Control, privacy-check, evidence-pack, and MCP setup as supporting workflows.

Use these release assets:
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-mission-control.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-proof-router.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-proof-cards.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-mission-control.gif`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.17.0/docs/projscan-mission-proof.gif`

Suggested copy:
projscan is the local proof layer for AI-assisted software engineering. In 4.17.0, it turns a task contract and proof receipt into an Agent Change Passport reviewers can read before approving an agent handoff. The passport names allowed files, forbidden files, changed files, proof replay, Proof Sufficiency, stale or missing proof, reviewer action, and next commands. Guard mode checks the current working tree against the saved contract during an agent session. Source stays local, no ProjScan account or API key is required, and MCP returns evidence without executing proof commands.

Publishing checklist:
- Every current-version label reads `4.17.0`.
- Tool count reads `49`.
- Language copy reads `11 AST adapters covering 12 named languages`.
- Overview and docs show `projscan passport --intent`, `projscan passport --contract`, `projscan guard --contract`, `projscan guard --watch`, `projscan prove --intent`, `projscan prove --run`, `projscan prove --changed`, `projscan assess --goal`, and `projscan simulate --plan`.
- Passport artifact path, artifact overwrite guard, reviewer action, proof replay, Proof Sufficiency, guard status, and MCP non-execution are visible.
- Baseframe artifact paths, task ID validation, manifest preservation, relative manifest paths, AgentLoopKit consumption, and AgentFlight follow-up are visible.
- Proof Replay, Proof Sufficiency, Team Proof Recipes, Proof Ledger freshness, stale proof, failed proof, reviewer decision, changed-after-proof files, and evidence-pack Proof Receipt sections remain visible.
- Screenshots load from the `v4.17.0` raw GitHub URLs.
- Search rendered pages for stale current-version labels from `4.9.3` through `4.16.0`; keep those strings in historical context.
```
