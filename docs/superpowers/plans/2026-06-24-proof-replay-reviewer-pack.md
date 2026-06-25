# Proof Replay Reviewer Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact reviewer replay summary to existing `prove --changed` and evidence-pack outputs.

**Architecture:** Reuse the existing Proof Ledger and Proof Receipt. Add an additive `proofReplay` object to receipts, derive timeline/status from command evidence and changed-file fingerprints, and render the result in markdown and PR comments.

**Tech Stack:** TypeScript, Vitest, existing projscan CLI/core modules, existing local proof ledger.

---

### Task 1: Core Replay Model

**Files:**
- Modify: `src/types/prove.ts`
- Modify: `src/core/prove.ts`
- Test: `tests/core/prove.test.ts`

- [ ] **Step 1: Write failing tests**

Add expectations to changed-receipt tests that `receipt.proofReplay` contains `status`, `events`, `changedAfterProof`, `replayCommand`, and `receiptFingerprint`.

- [ ] **Step 2: Run focused test to verify it fails**

Run: `npm test -- tests/core/prove.test.ts`
Expected: FAIL because `proofReplay` is not defined on receipts.

- [ ] **Step 3: Add additive types and minimal computation**

Add replay event/status types and build `proofReplay` inside `buildReceipt()` from existing scope, proof status, proof sufficiency, and ledger evidence. The fingerprint hashes local metadata only: scope files, proof command statuses, sufficiency status, risk delta, and reviewer decision.

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npm test -- tests/core/prove.test.ts`
Expected: PASS.

### Task 2: CLI Markdown Rendering

**Files:**
- Modify: `src/cli/commands/prove.ts`
- Test: `tests/cli/prove.test.ts`
- Test: `tests/docs/proveDocs.test.ts`

- [ ] **Step 1: Write failing render tests**

Assert markdown includes `## Proof Replay`, replay status, changed-after-proof details, replay command, and receipt fingerprint.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm test -- tests/cli/prove.test.ts tests/docs/proveDocs.test.ts`
Expected: FAIL because the new replay fields are not rendered.

- [ ] **Step 3: Render compact replay section**

Render `receipt.proofReplay` in markdown and console without adding a new CLI option.

- [ ] **Step 4: Run focused tests to verify pass**

Run: `npm test -- tests/cli/prove.test.ts tests/docs/proveDocs.test.ts`
Expected: PASS.

### Task 3: Evidence-Pack PR Comment

**Files:**
- Modify: `src/types/evidencePack.ts`
- Modify: `src/core/releaseEvidence.ts`
- Modify: `src/core/evidenceComment.ts`
- Test: `tests/core/releaseEvidence.test.ts`

- [ ] **Step 1: Write failing PR-comment test**

Assert `evidence-pack --pr-comment` includes proof replay status, changed-after-proof files, replay command, and receipt fingerprint when a receipt is available.

- [ ] **Step 2: Run focused test to verify failure**

Run: `npm test -- tests/core/releaseEvidence.test.ts`
Expected: FAIL because evidence-pack does not expose replay fields.

- [ ] **Step 3: Add summary fields and PR rendering**

Copy compact replay fields from the proof receipt into `EvidencePackProofReceiptSummary` and render them under `### Proof Receipt`.

- [ ] **Step 4: Run focused test to verify pass**

Run: `npm test -- tests/core/releaseEvidence.test.ts`
Expected: PASS.

### Task 4: Docs, Security, Performance, Handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/STABILITY.md`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Update user-facing docs**

Describe replay as a reviewer receipt improvement, not a new product claim. Include the existing `prove --changed` and `evidence-pack --pr-comment` commands.

- [ ] **Step 2: Run stop-slop review**

Check touched prose for filler, overclaiming, and stale release wording.

- [ ] **Step 3: Run verification**

Run the task commands in `.agentloop/tasks/2026-06-24-proof-replay-reviewer-pack.md`, plus security scan and AgentLoop gates.

- [ ] **Step 4: Handoff**

Summarize changed files, verification, residual risks, and rollback notes. Do not release.
