# Website Update Prompt

Use this prompt after `projscan@4.14.0`, GitHub release `v4.14.0`, and MCP
Registry metadata are live.

Current live-site baseline checked on 2026-06-24:

- `https://www.baseframelabs.com/apps/projscan` still shows older release
  labels and older MCP tool-count copy in the visible product sections.
- `https://www.baseframelabs.com/apps/projscan/docs` still leads with older
  docs copy. Keep older release notes only as history.
- Do not edit `https://www.baseframelabs.com/apps/projscan/changelog`; it
  updates from the release feed.

## Next Release Prompt: Verified Change Workflow and Executed Proof Runner

```text
Update the projscan website for projscan 4.14.0.

Pages to update:
- https://www.baseframelabs.com/apps/projscan
- https://www.baseframelabs.com/apps/projscan/docs

Do not edit:
- https://www.baseframelabs.com/apps/projscan/changelog
The changelog updates automatically.

Release headline:
4.14.0: Verified Change Workflow and Executed Proof Runner

Primary story:
projscan 4.14.0 makes the proof-first workflow executable. `projscan start
--intent "is my agent allowed to change billing retry logic?"` now routes to
`projscan prove`, `projscan prove --intent` creates the local Proof Contract
before editing, `projscan prove --run -- <command...>` executes a local proof
command and records a redacted `prove-run` ledger row, and `projscan prove
--changed` replays that executed evidence against the final diff.

Above the fold:
- Lead with: "Know whether the agent stayed inside the contract."
- Hero command: `npx projscan start --intent "is my agent allowed to change billing retry logic?"`
- Contract command: `npx projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json`
- Executed proof command: `npx projscan prove --run -- npm test -- tests/billing/retry.test.ts`
- Receipt command: `npx projscan prove --changed --contract .projscan/proof-contract.json --format markdown`
- Keep Proof Cards nearby: `npx projscan assess --goal "make this repo safer to ship this week"`
- Keep simulator nearby: `npx projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules"`
- Version: `4.14.0`
- MCP tools: `48 MCP tools`
- MCP Registry name: `io.github.abhiyoheswaran1/projscan`
- MCP Registry description: `Agent-first MCP. 11 AST adapters, 12 named languages, 48 tools, mission outcomes. Local.`
- Language support: `11 AST adapters covering 12 named languages`
- Requirements: Node.js >= 18

New release bullets:
- Agent-permission intents in `projscan start` route directly to `projscan prove`.
- The daily proof path is now `start -> prove -> run -> changed`.
- `projscan prove --run -- <command...>` executes an explicit local proof command with shell execution disabled.
- Executed proof records include source `prove-run`, command, exit code, duration, changed-file fingerprint, redacted summary, and log path.
- Executed proof logs stay under `.projscan/proof-logs/`.
- `projscan prove --changed` replays executed proof evidence and marks proof as passed, missing, failed, partial, or stale.
- Proof Receipts separate allowed production, expected tests, documentation,
  generated proof artifacts, config or security drift, forbidden touches, and
  unexpected production files.
- Proof Receipts ignore local `.projscan/` proof artifacts for scope drift.
- `verifiedWorkflow` appears in prove JSON for contract, run, record, and receipt modes.
- `projscan prove --record-command` remains available for imported CI or external proof evidence.
- MCP still exposes `projscan_prove`, bringing the server to 48 tools. MCP does not execute arbitrary commands in this release.

Docs page additions:
- Add "Verified change workflow":
  - `npx projscan start --intent "is my agent allowed to change billing retry logic?"`
  - `npx projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json`
  - `npx projscan prove --run -- npm test -- tests/billing/retry.test.ts`
  - `npx projscan prove --changed --contract .projscan/proof-contract.json --format markdown`
- Explain that `prove --run` executes a local command supplied after `--`.
- Explain that `prove --run` uses shell-disabled argv execution, stores redacted proof logs under `.projscan/proof-logs/`, and records a `prove-run` ledger row.
- Explain that `prove --record-command` records imported proof from CI or another trusted runner. It does not execute the command.
- Explain that `prove --changed` validates the final working tree after editing, classifies changed files, replays ledger evidence, and marks missing, failed, partial, or stale proof before giving a reviewer decision.
- Keep Proof Cards, simulate, Mission Control, privacy-check, evidence-pack, and MCP setup as supporting workflows.

Use these release assets:
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.14.0/docs/projscan-mission-control.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.14.0/docs/projscan-proof-router.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.14.0/docs/projscan-proof-cards.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.14.0/docs/projscan-mission-control.gif`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.14.0/docs/projscan-mission-proof.gif`

Suggested copy:
projscan is the local proof layer for AI-assisted software engineering. In
4.14.0, a developer or agent can start with an intent, save a Proof Contract,
run the required proof command through projscan, and then replay the final diff
for a reviewer. The receipt shows whether the edit stayed in scope, whether the
proof is fresh, which files need attention, and whether the change is ready for
review. Core scans still run locally by default, source is not uploaded, and no
projscan account or API key is required.

Publishing checklist:
- Every current-version label reads `4.14.0`.
- Tool count reads `48`.
- Language copy reads `11 AST adapters covering 12 named languages`.
- Overview and docs show `projscan start --intent`, `projscan prove --intent`,
  `projscan prove --run`, `projscan prove --changed`, `projscan assess --goal`,
  and `projscan simulate --plan`.
- Proof Contract fields, executed proof records, Proof Ledger freshness, Proof
  Receipts, stale proof, failed proof, reviewer decision, and evidence-pack
  Proof Receipt section are visible.
- Screenshots load from the `v4.14.0` raw GitHub URLs.
- Search rendered pages for stale current-version labels from `4.9.3` through
  `4.13.0`; keep those strings only in historical context.
```
