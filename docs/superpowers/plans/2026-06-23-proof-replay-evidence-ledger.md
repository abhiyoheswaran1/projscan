# Proof Replay Evidence Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make existing Proof Contracts, Mission Control, and evidence packs verifiable by recording local proof outcomes and replaying them in receipts.

**Architecture:** Add a small local ledger core that writes and reads JSONL proof rows under `.projscan/`. `prove --record-command` appends explicit outcomes without executing shell commands. `prove --changed` consumes the ledger and enriches Proof Receipts. Mission Control appends ledger rows from commands it already runs, and evidence-pack includes the latest receipt summary when available.

**Tech Stack:** TypeScript, Node standard library, Commander CLI, Vitest, existing projscan CLI/MCP/core patterns, existing README media scripts.

---

## File Structure

- Create `src/types/proofLedger.ts`: ledger row, command evidence, proof decision, and outcome types.
- Create `src/core/proofLedger.ts`: JSONL read/write, command normalization, changed-file fingerprint, output redaction, and matching helpers.
- Modify `src/types/prove.ts`: add proof replay status, command evidence, risk direction, and reviewer decision fields.
- Modify `src/core/prove.ts`: support record mode, read ledger in changed mode, compute proof replay status, stale evidence, risk direction, and reviewer decision.
- Modify `src/cli/commands/prove.ts`: add `--record-command`, `--exit-code`, `--duration-ms`, `--summary`, `--log`, `--ledger`, and receipt Markdown sections.
- Modify `src/cli/commands/startMissionBundle.ts`: have `mission.sh` append safe ledger rows when it already runs proof commands.
- Modify `src/types/evidencePack.ts`, `src/core/releaseEvidence.ts`, and `src/core/evidenceComment.ts`: include Proof Receipt summary in PR comments.
- Modify `src/types/dogfood.ts` and `src/core/feedback.ts`: add optional proof outcome fields to Trust Memory feedback.
- Update tests in `tests/core/prove.test.ts`, `tests/cli/prove.test.ts`, `tests/core/releaseEvidence.test.ts`, `tests/cli/startMissionBundle.test.ts`, and docs tests.
- Update `README.md`, `docs/GUIDE.md`, `docs/WEBSITE-UPDATE-PROMPT.md`, `DECISIONS.md`, and README media assets.

## Task 1: Ledger Types And Core Tests

**Files:**
- Create: `src/types/proofLedger.ts`
- Create: `src/core/proofLedger.ts`
- Modify: `tests/core/prove.test.ts`

- [ ] **Step 1: Write failing ledger tests**

Add tests that call `appendProofLedgerRecord` and `readProofLedger` through `computeProve` record/changed mode. Assert the ledger row contains command, exit code, duration, timestamp, fingerprint, changed files, redacted summary, and relative log path.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/core/prove.test.ts`

Expected: fails because proof ledger functions and receipt replay fields do not exist.

- [ ] **Step 3: Implement ledger core**

Use Node `fs`, `path`, and `crypto`. Keep JSONL append-only. Normalize commands by trimming whitespace runs. Redact output summaries with conservative patterns for bearer tokens, key names, passwords, webhooks, and `.env` values.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/core/prove.test.ts`

Expected: ledger tests pass.

## Task 2: Prove Record Mode And Receipt Replay

**Files:**
- Modify: `src/types/prove.ts`
- Modify: `src/core/prove.ts`
- Modify: `src/cli/commands/prove.ts`
- Modify: `tests/cli/prove.test.ts`

- [ ] **Step 1: Write failing record-mode CLI tests**

Test `projscan prove --record-command "npm test -- tests/core/prove.test.ts" --exit-code 0 --duration-ms 123 --summary "13 tests passed" --format json` writes `.projscan/proof-ledger.jsonl` and returns a record report.

- [ ] **Step 2: Write failing receipt replay tests**

Create a contract, record one passing required command, run `prove --changed`, and assert command evidence shows passed/fresh. Record a failing command and assert reviewer decision is `stop`. Modify changed files after recording and assert stale proof.

- [ ] **Step 3: Verify RED**

Run: `npm run build && npm test -- tests/core/prove.test.ts tests/cli/prove.test.ts`

Expected: fails on missing options and receipt fields.

- [ ] **Step 4: Implement record mode and replay matching**

Add a third prove mode internally for recording while keeping public `mode` additive. Do not execute shell commands. Build proof status from required commands and ledger evidence.

- [ ] **Step 5: Verify GREEN**

Run: `npm run build && npm test -- tests/core/prove.test.ts tests/cli/prove.test.ts`

Expected: record and replay tests pass.

## Task 3: Mission Control Ledger Recording

**Files:**
- Modify: `src/cli/commands/startMissionBundle.ts`
- Modify: `tests/cli/startMissionBundle.test.ts`

- [ ] **Step 1: Write failing mission script assertions**

Assert generated `mission.sh` defines a repo-level ledger path and appends ledger JSONL rows after each command it already logs.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/cli/startMissionBundle.test.ts`

Expected: fails because mission script does not mention proof ledger.

- [ ] **Step 3: Implement shell-safe ledger appends**

Use existing command, log, id, label, and exit status values. Write summaries as a short status line, not raw logs. If repo root cannot be found, skip ledger write and keep mission behavior unchanged.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/cli/startMissionBundle.test.ts`

Expected: mission bundle tests pass.

## Task 4: Evidence Pack PR Comment Integration

**Files:**
- Modify: `src/types/evidencePack.ts`
- Modify: `src/core/releaseEvidence.ts`
- Modify: `src/core/evidenceComment.ts`
- Modify: `tests/core/releaseEvidence.test.ts`
- Modify: `tests/cli/evidenceRegression.test.ts`

- [ ] **Step 1: Write failing evidence-pack tests**

Create a fixture with `.projscan/proof-contract.json` and `.projscan/proof-ledger.jsonl`. Assert `computeEvidencePack(..., { includePrComment: true })` includes `proofReceipt` and the PR comment has `### Proof Receipt`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/core/releaseEvidence.test.ts tests/cli/evidenceRegression.test.ts`

Expected: fails because evidence-pack does not read proof receipts.

- [ ] **Step 3: Implement optional receipt loading**

Call `computeProve(rootPath, { changed: true })` inside evidence-pack with errors caught. Include receipt summary only when useful; never block evidence-pack on missing proof replay.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/core/releaseEvidence.test.ts tests/cli/evidenceRegression.test.ts`

Expected: evidence-pack tests pass.

## Task 5: Trust Memory Outcome Fields

**Files:**
- Modify: `src/types/dogfood.ts`
- Modify: `src/core/feedback.ts`
- Modify: `src/core/prove.ts`
- Modify: `tests/core/feedback.test.ts`
- Modify: `tests/core/prove.test.ts`

- [ ] **Step 1: Write failing feedback tests**

Assert feedback accepts optional proof outcome fields and `prove --intent --feedback` lowers confidence for rejected/noisy/reverted outcomes.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/core/feedback.test.ts tests/core/prove.test.ts`

Expected: fails because feedback normalization drops proof outcome fields.

- [ ] **Step 3: Implement additive feedback fields**

Preserve existing feedback schema and add optional fields only. Treat accepted outcomes as positive signals and rejected/reverted/noisy outcomes as negative signals.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/core/feedback.test.ts tests/core/prove.test.ts`

Expected: feedback and prove tests pass.

## Task 6: Docs, Media, And Website Prompt

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`
- Modify: `DECISIONS.md`
- Modify: `tests/docs/proveDocs.test.ts`
- Add or update: README demo/screenshot assets under `docs/`

- [ ] **Step 1: Write docs test expectations**

Assert README and guide include `prove --record-command`, Proof Ledger, stale proof, reviewer decision, and evidence-pack Proof Receipt section.

- [ ] **Step 2: Update prose with stop-slop pass**

Keep claims concrete: local JSONL ledger, no shell execution, no remote upload, no raw secret output, no release.

- [ ] **Step 3: Regenerate media**

Run `npm run docs:screenshots` and, if the demo scripts cover prove output, `npm run docs:demos`. If existing scripts do not cover Proof Replay, add the smallest deterministic script needed.

- [ ] **Step 4: Verify docs**

Run: `npm test -- tests/docs/proveDocs.test.ts`

Expected: docs tests pass.

## Task 7: Full Passes And Handoff

**Files:**
- No new production files unless a pass exposes a bug.

- [ ] **Step 1: Focused verification**

Run:

```bash
npm test -- tests/core/prove.test.ts tests/cli/prove.test.ts tests/mcp/prove.test.ts tests/docs/proveDocs.test.ts
npm test -- tests/core/releaseEvidence.test.ts tests/cli/evidenceRegression.test.ts tests/cli/startMissionBundle.test.ts
```

- [ ] **Step 2: Static and build verification**

Run:

```bash
npm run typecheck
npm run lint
npm run build
npm run check:stability
```

- [ ] **Step 3: Dogfood bug and security passes**

Run:

```bash
npm exec projscan -- doctor --format json
npm exec projscan -- bug-hunt --format json
npm exec projscan -- privacy-check --format json
npm exec projscan -- prove --changed --format json
npm exec projscan -- evidence-pack --pr-comment --format markdown
```

- [ ] **Step 4: Performance pass**

Run `/usr/bin/time -l` around `prove --changed` and `evidence-pack --pr-comment` on this repo. Record real time and peak footprint in the handoff.

- [ ] **Step 5: AgentLoop verification**

Run:

```bash
npm exec agentloop -- verify --task .agentloop/tasks/2026-06-23-proof-replay-evidence-ledger.md --task-commands --only-task-commands --write-run
npm exec agentloop -- handoff --write-run
npm exec agentloop -- check-gates
npm exec agentloop -- ship
```

Expected: verification passes, gates pass or only identify review-scope warnings, and no release action occurs.
