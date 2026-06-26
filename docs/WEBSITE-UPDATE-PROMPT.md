# Website Update Prompt

Use this prompt after `projscan@4.16.0`, GitHub release `v4.16.0`, and MCP
Registry metadata are live.

Pages to update:

- `https://www.baseframelabs.com/apps/projscan`
- `https://www.baseframelabs.com/apps/projscan/docs`

Do not edit:

- `https://www.baseframelabs.com/apps/projscan/changelog`

The changelog updates automatically.

```text
Update the projscan website for projscan 4.16.0.

Pages to update:
- https://www.baseframelabs.com/apps/projscan
- https://www.baseframelabs.com/apps/projscan/docs

Do not edit:
- https://www.baseframelabs.com/apps/projscan/changelog
The changelog updates automatically.

Release headline:
4.16.0: Baseframe Suite Assessment Export

Primary story:
projscan 4.16.0 adds the ProjScan side of Baseframe Suite Integration v1. ProjScan finds the risk, AgentLoopKit controls the work, and AgentFlight proves the result through local, versioned JSON artifacts. A specific task can now get a stable `projscan-assessment.json` that captures verdict, impacted areas, review focus, risks, suggested checks, repository metadata, and known limitations without making ProjScan depend on AgentLoopKit or AgentFlight packages.

Above the fold:
- Lead with: "ProjScan finds the risk before the task contract is written."
- Baseframe command: `npx projscan assess --intent "Implement password reset" --task-id auth-password-reset-20260626-01 --emit-baseframe`
- Assessment artifact: `.baseframe/evidence/<task-id>/projscan-assessment.json`
- Workflow manifest: `.baseframe/agent-workflow.json`
- Proof Contract command: `npx projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json`
- Executed proof command: `npx projscan prove --run -- npm test -- tests/billing/retry.test.ts`
- Receipt command: `npx projscan prove --changed --contract .projscan/proof-contract.json --format markdown`
- Keep Proof Cards nearby: `npx projscan assess --goal "make this repo safer to ship this week"`
- Keep simulator nearby: `npx projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules"`
- Version: `4.16.0`
- MCP tools: `48 MCP tools`
- MCP Registry name: `io.github.abhiyoheswaran1/projscan`
- MCP Registry description: `Agent-first MCP. 11 AST adapters, 12 named languages, 48 tools, mission outcomes. Local.`
- Language support: `11 AST adapters covering 12 named languages`
- Requirements: Node.js >= 18

New release bullets:
- `projscan assess --intent <text> --task-id <id> --emit-baseframe` writes `.baseframe/evidence/<task-id>/projscan-assessment.json`.
- `projscan assess --output <path>` supports explicit ProjScan-owned Baseframe assessment paths.
- The assessment schema is stable and machine-readable: `schemaVersion`, `kind`, producer metadata, `taskId`, `intent`, generation time, repository root, branch, commit, verdict, summary, repository type, impacted areas, review focus, risks, suggested checks, and optional local artifacts.
- `.baseframe/agent-workflow.json` is created or updated with relative repository paths, shared timestamps, and `tools.projscan`.
- Manifest updates preserve AgentLoopKit, AgentFlight, and unknown fields.
- Artifact writes are local-only, atomic, deterministic, task-ID validated, and protected against traversal and symlink output paths.
- The package exports `createBaseframeAssessment()` plus Baseframe v1 assessment and workflow manifest types.
- AgentLoopKit can consume the ProjScan assessment to write its own task contract at `.baseframe/evidence/<task-id>/agentloopkit-task.json`.
- AgentFlight can later consume both files for review readiness; ProjScan does not write AgentLoopKit or AgentFlight artifacts.
- Existing proof workflows remain independent: Proof Replay, Proof Sufficiency, Team Proof Recipes, Proof Ledger freshness, stale proof, failed proof, reviewer decision, changed-after-proof files, and evidence-pack proof replay, proof sufficiency, recipe gaps are still supported.
- MCP still exposes `projscan_prove`; MCP can create, replay, and record imported proof. Only CLI `prove --run` executes local commands.

Docs page additions:
- Add "Baseframe Suite Integration v1":
  - `npx projscan assess --intent "Implement password reset" --task-id auth-password-reset-20260626-01 --emit-baseframe`
  - `.baseframe/evidence/<task-id>/projscan-assessment.json`
  - `.baseframe/agent-workflow.json`
- Explain that ProjScan owns only `projscan-assessment.json` and may update the shared workflow manifest.
- Explain that AgentLoopKit reads the assessment and writes `agentloopkit-task.json` separately.
- Explain that AgentFlight reads both later and writes `agentflight-result.json` separately.
- Mention task IDs are supplied explicitly, filesystem-safe, and shared across the three tools.
- Keep Proof Replay and Sufficiency:
  - `npx projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json`
  - `npx projscan prove --run -- npm test -- tests/billing/retry.test.ts`
  - `npx projscan prove --changed --contract .projscan/proof-contract.json --format markdown`
- Keep Proof Cards, simulate, Mission Control, privacy-check, evidence-pack, and MCP setup as supporting workflows.

Use these release assets:
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.16.0/docs/projscan-mission-control.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.16.0/docs/projscan-proof-router.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.16.0/docs/projscan-proof-cards.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.16.0/docs/projscan-mission-control.gif`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.16.0/docs/projscan-mission-proof.gif`

Suggested copy:
projscan is the local risk and proof layer for AI-assisted software engineering. In 4.16.0, it can assess a repository for a specific Baseframe Suite task and export a stable local `projscan-assessment.json` for AgentLoopKit to consume. The artifact names impacted areas, review focus, risks, suggested checks, verdict, and repository evidence while preserving ProjScan's independent proof workflows. Source stays local, no ProjScan account or API key is required, and ProjScan does not upload code or write AgentLoopKit or AgentFlight artifacts.

Publishing checklist:
- Every current-version label reads `4.16.0`.
- Tool count reads `48`.
- Language copy reads `11 AST adapters covering 12 named languages`.
- Overview and docs show `projscan assess --intent`, `projscan assess --emit-baseframe`, `projscan prove --intent`, `projscan prove --run`, `projscan prove --changed`, `projscan assess --goal`, and `projscan simulate --plan`.
- Baseframe artifact paths, task ID validation, manifest preservation, relative manifest paths, AgentLoopKit consumption, and AgentFlight follow-up are visible.
- Proof Replay, Proof Sufficiency, Team Proof Recipes, Proof Ledger freshness, stale proof, failed proof, reviewer decision, changed-after-proof files, and evidence-pack Proof Receipt sections remain visible.
- Screenshots load from the `v4.16.0` raw GitHub URLs.
- Search rendered pages for stale current-version labels from `4.9.3` through `4.15.0`; keep those strings only in historical context.
```
