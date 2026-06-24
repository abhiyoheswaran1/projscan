# Website Update Prompt

Use this prompt after `projscan@4.13.0`, GitHub release `v4.13.0`, and MCP
Registry metadata are live.

Current live-site baseline checked on 2026-06-24:

- `https://www.baseframelabs.com/apps/projscan` still shows older release
  labels and older MCP tool-count copy in the visible product sections.
- `https://www.baseframelabs.com/apps/projscan/docs` still leads with older
  docs copy. Keep older release notes only as history.
- Do not edit `https://www.baseframelabs.com/apps/projscan/changelog`; it
  updates from the release feed.

## Next Release Prompt: Proof Replay for Executable Proof Contracts

```text
Update the projscan website for projscan 4.13.0.

Pages to update:
- https://www.baseframelabs.com/apps/projscan
- https://www.baseframelabs.com/apps/projscan/docs

Do not edit:
- https://www.baseframelabs.com/apps/projscan/changelog
The changelog updates automatically.

Release headline:
4.13.0: Proof Replay for Executable Proof Contracts

Primary story:
projscan 4.13.0 adds Proof Replay to the existing proof-first workflow.
`projscan prove --intent "<change>"` creates a local Proof Contract before an
engineer or coding agent edits. The contract names allowed files, forbidden
files, risky contracts, likely tests, proof commands, rollback notes,
confidence, evidence gaps, Trust Memory signals, and reviewer guidance.
`projscan prove --record-command "<command>" --exit-code <code>` records proof
outcomes in `.projscan/proof-ledger.jsonl` with a changed-file fingerprint and
redacted summary. `projscan prove --changed` validates the final working tree
against that contract and ledger, then emits a reviewer-ready Proof Receipt.

Above the fold:
- Lead with: "Know whether the change stayed inside the contract."
- Hero command: `npx projscan prove --intent "is my agent allowed to change billing retry logic?"`
- Supporting command: `npx projscan prove --record-command "npm test -- tests/billing/retry.test.ts" --exit-code 0 --duration-ms 1842 --summary "billing retry tests passed"`
- Receipt command: `npx projscan prove --changed --contract .projscan/proof-contract.json --format markdown`
- Keep Proof Cards nearby: `npx projscan assess --goal "make this repo safer to ship this week"`
- Keep simulator nearby: `npx projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules"`
- Version: `4.13.0`
- MCP tools: `48 MCP tools`
- MCP Registry name: `io.github.abhiyoheswaran1/projscan`
- MCP Registry description: `Agent-first MCP. 11 AST adapters, 12 named languages, 48 tools, mission outcomes. Local.`
- Language support: `11 AST adapters covering 12 named languages`
- Requirements: Node.js >= 18

New release bullets:
- `projscan prove --intent "<change>"` creates an executable Proof Contract before editing.
- Proof Contracts include allowed files, forbidden files, risky contracts,
  likely tests, missing regression-test evidence, proof commands, safe change
  shape, rollback, confidence, evidence gaps, Trust Memory summary, and
  reviewer guidance.
- `projscan prove --record-command "<command>" --exit-code <code>` records a
  local proof outcome without executing the command.
- Proof Ledger rows include command, exit code, duration, changed-file
  fingerprint, redacted summary, optional log path, and source.
- `projscan prove --changed` validates the working tree against the contract and
  ledger, then reports scope drift, forbidden touches, proof status, stale
  proof, failed proof, risk delta, reviewer decision, and commit readiness.
- Proof Receipts separate allowed production, expected tests, documentation,
  generated proof artifacts, config or security drift, forbidden touches, and
  unexpected production files.
- Mission Control `mission.sh` appends Proof Ledger rows while it runs the
  existing proof queue.
- `projscan evidence-pack --pr-comment` includes the latest Proof Receipt
  summary when a contract and ledger are available.
- Trust Memory now records proof outcomes such as accepted, rejected, reverted,
  suppressed, and noisy, then feeds those outcomes into future Proof Contract
  confidence.
- MCP exposes `projscan_prove`, bringing the server to 48 tools.
- Custom Proof Ledger paths must stay inside the project root.

Docs page additions:
- Add "Executable Proof Contracts":
  - `npx projscan prove --intent "is my agent allowed to change billing retry logic?" --format json`
  - `npx projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json`
  - `npx projscan prove --record-command "npm test -- tests/billing/retry.test.ts" --exit-code 0 --duration-ms 1842 --summary "billing retry tests passed"`
  - `npx projscan prove --changed --contract .projscan/proof-contract.json --format markdown`
- Explain that `prove --intent` creates the contract before editing.
- Explain that `prove --record-command` records a local outcome. It does not run
  the command.
- Explain that `prove --changed` validates the final working tree after editing,
  classifies changed files, replays ledger evidence, and marks missing, failed,
  partial, or stale proof before giving a reviewer decision.
- Keep Proof Cards, simulate, Mission Control, privacy-check, evidence-pack, and
  MCP setup as supporting workflows.

Use these release assets:
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.13.0/docs/projscan-mission-control.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.13.0/docs/projscan-proof-router.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.13.0/docs/projscan-proof-cards.png`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.13.0/docs/projscan-mission-control.gif`
- `https://raw.githubusercontent.com/abhiyoheswaran1/projscan/v4.13.0/docs/projscan-mission-proof.gif`

Suggested copy:
projscan is the local proof layer for AI-assisted software engineering.
Before an engineer or coding agent edits, `projscan prove --intent` defines the
allowed scope and required proof. After proof commands run, `projscan prove
--record-command` records the outcome locally. After the edit, `projscan prove
--changed` produces a Proof Receipt showing whether the work stayed inside
scope, whether the proof is fresh, which files need reviewer attention, and
whether the change is ready for review. Source stays local by default, telemetry
stays off until opted in, and no projscan account or API key is required.

Publishing checklist:
- Every current-version label reads `4.13.0`.
- Tool count reads `48`.
- Language copy reads `11 AST adapters covering 12 named languages`.
- Overview and docs show `projscan prove --intent`, `projscan prove
  --record-command`, `projscan prove --changed`, `projscan assess --goal`, and
  `projscan simulate --plan`.
- Proof Contract fields and Proof Receipt fields are visible.
- Proof Ledger, proof freshness, failed proof, stale proof, reviewer decision,
  and evidence-pack Proof Receipt section are visible.
- Screenshots load from the `v4.13.0` raw GitHub URLs.
- Search rendered pages for stale current-version labels from `4.9.3` through
  `4.12.1`; keep those strings only in historical context.
```
