# Proof Sufficiency Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a proof requirements matrix and proof sufficiency summary to the existing `prove` and `evidence-pack` workflows.

**Architecture:** `src/core/prove.ts` remains the owner of Proof Contracts, Proof Receipts, changed-file classification, and ledger replay. The new matrix is built during contract creation and evaluated during receipt creation from already loaded receipt inputs. CLI and evidence-pack renderers consume the additive fields.

**Tech Stack:** TypeScript, Vitest, Node.js `spawn` remains shell-disabled for proof execution, existing AgentLoopKit verification.

---

### Task 1: Contract Requirements Matrix

**Files:**
- Modify: `src/types/prove.ts`
- Modify: `src/core/prove.ts`
- Test: `tests/core/prove.test.ts`

- [ ] **Step 1: Write the failing contract test**

Add this assertion to `builds an executable contract from an intent` in `tests/core/prove.test.ts`:

```ts
expect(report.contract?.proofRequirements).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      surface: 'production',
      files: expect.arrayContaining(['src/core/bugHunt.ts']),
      requiredCommands: expect.arrayContaining([
        'npm test -- tests/core/bugHunt.test.ts',
      ]),
      requiredReview: 'review changed production behavior and matching regression proof',
    }),
    expect.objectContaining({
      surface: 'test',
      files: expect.arrayContaining(['tests/core/bugHunt.test.ts']),
      requiredCommands: expect.arrayContaining([
        'npm test -- tests/core/bugHunt.test.ts',
      ]),
    }),
  ]),
);
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
npm test -- tests/core/prove.test.ts -t "builds an executable contract from an intent"
```

Expected: fail because `proofRequirements` is missing.

- [ ] **Step 3: Add additive proof requirement types**

In `src/types/prove.ts`, add `ProveRiskSurface`, `ProveProofRequirement`, and `proofRequirements: ProveProofRequirement[]` to `ProveContract`.

- [ ] **Step 4: Build matrix in `buildContract`**

In `src/core/prove.ts`, add helpers that derive production, test, CLI, MCP, public API, config/security, docs, and generated requirement rows from `allowedFiles`, `likelyTests`, `riskyContracts`, and `proofCommands`.

- [ ] **Step 5: Run the focused test and confirm it passes**

Run:

```bash
npm test -- tests/core/prove.test.ts -t "builds an executable contract from an intent"
```

Expected: pass.

### Task 2: Receipt Sufficiency Evaluation

**Files:**
- Modify: `src/types/prove.ts`
- Modify: `src/core/prove.ts`
- Test: `tests/core/prove.test.ts`

- [ ] **Step 1: Write failing receipt tests**

Add tests that:

- record every required command and expect `proofSufficiency.status` to be `strong` or `adequate`
- skip proof evidence and expect `missing`
- record stale proof before editing and expect `stale`
- record a failed command and expect `failed`

- [ ] **Step 2: Run the tests and confirm they fail**

Run:

```bash
npm test -- tests/core/prove.test.ts -t "proof sufficiency"
```

Expected: fail because receipt sufficiency is missing.

- [ ] **Step 3: Add additive sufficiency types**

In `src/types/prove.ts`, add `ProveProofSufficiencyStatus`, `ProveProofRequirementResult`, `ProveProofSufficiency`, and `proofSufficiency: ProveProofSufficiency` to `ProveReceipt`. Add optional `proofSufficiencyStatus` to `ProveVerifiedWorkflow`.

- [ ] **Step 4: Implement sufficiency evaluation**

In `src/core/prove.ts`, evaluate each contract requirement against `receipt.proofStatus.commandEvidence` and `receipt.scope.classifications`. Set overall status from the most severe row.

- [ ] **Step 5: Wire sufficiency into readiness and verified workflow**

Treat `missing`, `stale`, and `weak` as review signals. Treat `failed` as blocked. Preserve existing blocking rules.

- [ ] **Step 6: Run the focused tests and confirm they pass**

Run:

```bash
npm test -- tests/core/prove.test.ts -t "proof sufficiency"
```

Expected: pass.

### Task 3: CLI Rendering

**Files:**
- Modify: `src/cli/commands/prove.ts`
- Test: `tests/cli/prove.test.ts`

- [ ] **Step 1: Write failing CLI rendering tests**

Update the markdown receipt test to expect `## Proof Sufficiency`, `sufficiency status`, and at least one requirement line.

- [ ] **Step 2: Run the focused CLI tests and confirm failure**

Run:

```bash
npm test -- tests/cli/prove.test.ts -t "prove changed reads a saved contract"
```

Expected: fail because markdown lacks the new section.

- [ ] **Step 3: Render sufficiency in console and markdown**

Add `printProofSufficiencyConsole`, `pushProofSufficiency`, and concise per-requirement formatting.

- [ ] **Step 4: Run CLI tests**

Run:

```bash
npm test -- tests/cli/prove.test.ts
```

Expected: pass.

### Task 4: Evidence Pack PR Comment

**Files:**
- Modify: `src/types/evidencePack.ts`
- Modify: `src/core/releaseEvidence.ts`
- Modify: `src/core/evidenceComment.ts`
- Test: `tests/core/releaseEvidence.test.ts`

- [ ] **Step 1: Write failing PR-comment test**

Extend `evidence pack PR comments include available Proof Replay receipts` to expect proof sufficiency status and missing/weak requirement counts.

- [ ] **Step 2: Run the test and confirm failure**

Run:

```bash
npm test -- tests/core/releaseEvidence.test.ts -t "Proof Replay receipts"
```

Expected: fail because the summary lacks proof sufficiency.

- [ ] **Step 3: Add evidence-pack summary fields**

Add `proofSufficiencyStatus`, `weakRequirements`, and `missingRequirements` to `EvidencePackProofReceiptSummary`.

- [ ] **Step 4: Render PR comment lines**

Add sufficiency status and concise requirement gaps to `formatProofReceipt`.

- [ ] **Step 5: Run the focused test**

Run:

```bash
npm test -- tests/core/releaseEvidence.test.ts -t "Proof Replay receipts"
```

Expected: pass.

### Task 5: Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/STABILITY.md`
- Modify: `DECISIONS.md`
- Test: `tests/docs/proveDocs.test.ts`

- [ ] **Step 1: Write failing docs expectations**

Update `tests/docs/proveDocs.test.ts` to require `Proof Sufficiency`, `proofRequirements`, and `proofSufficiency`.

- [ ] **Step 2: Run docs test and confirm failure**

Run:

```bash
npm test -- tests/docs/proveDocs.test.ts
```

Expected: fail until docs are updated.

- [ ] **Step 3: Update docs with grounded copy**

Describe Proof Sufficiency in the Verified Change Workflow and command reference. Do not change current version labels, changelog, package metadata, or release artifacts.

- [ ] **Step 4: Run docs test**

Run:

```bash
npm test -- tests/docs/proveDocs.test.ts
```

Expected: pass.

### Task 6: Verification Pass

**Files:**
- All changed files in this task.

- [ ] **Step 1: Run task-specific test suite**

Run:

```bash
npm test -- tests/core/prove.test.ts tests/cli/prove.test.ts tests/core/releaseEvidence.test.ts tests/docs/proveDocs.test.ts
```

Expected: pass.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: pass.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: pass.

- [ ] **Step 4: Run AgentLoop task verification**

Run:

```bash
npm exec agentloop -- verify --task .agentloop/tasks/2026-06-24-proof-sufficiency-engine.md --task-commands --only-task-commands --write-run
```

Expected: pass.

- [ ] **Step 5: Run gates and handoff**

Run:

```bash
npm exec agentloop -- check-gates
npm exec agentloop -- ship
```

Expected: no blocking gate.
