# Verified Change Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the existing proof-first workflow so `start`, `prove`, MCP, and docs present one verified change path.

**Architecture:** Add `projscan_prove` to deterministic intent routing, then add a compact `verifiedWorkflow` summary to existing proof reports. Keep existing command behavior and output fields intact.

**Tech Stack:** TypeScript, Vitest, existing CLI/MCP helpers, AgentLoopKit verification.

---

### Task 1: Route Agent-Permission Intents To Prove

**Files:**
- Modify: `src/core/intentRouterCatalog.ts`
- Modify: `src/core/intentRouterWorkflowKeywordWeights.ts`
- Modify: `src/core/startRouteActions.ts`
- Test: `tests/core/intentRouter.test.ts`
- Test: `tests/cli/startIntentRouting.test.ts`

- [ ] **Step 1: Write failing router tests**

Add tests that expect:

```ts
expect(routeIntent('is my agent allowed to change billing retry logic').matches[0].tool).toBe('projscan_prove');
expect(routeIntent('is it safe to commit this change').matches[0].tool).toBe('projscan_preflight');
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
npm test -- tests/core/intentRouter.test.ts tests/cli/startIntentRouting.test.ts
```

Expected: fail because `projscan_prove` is not a router entry.

- [ ] **Step 3: Add catalog and command builders**

Add a narrow `projscan_prove` route with command builder:

```ts
projscan_prove: ({ intent }) => ({
  intent,
  save_contract_path: '.projscan/proof-contract.json',
})
```

and CLI builder:

```ts
projscan prove --intent "<intent>" --save-contract .projscan/proof-contract.json --format json
```

- [ ] **Step 4: Run tests and verify green**

Run:

```bash
npm test -- tests/core/intentRouter.test.ts tests/cli/startIntentRouting.test.ts
```

Expected: pass.

### Task 2: Add Verified Workflow Summary To Prove

**Files:**
- Modify: `src/types/prove.ts`
- Modify: `src/core/prove.ts`
- Modify: `src/cli/commands/prove.ts`
- Modify: `src/mcp/tools/prove.ts`
- Test: `tests/core/prove.test.ts`
- Test: `tests/cli/prove.test.ts`
- Test: `tests/mcp/prove.test.ts`

- [ ] **Step 1: Write failing proof tests**

Add tests for:

```ts
expect(report.verifiedWorkflow?.phase).toBe('contract');
expect(report.verifiedWorkflow?.nextCommand).toContain('projscan prove --changed');
expect(changedReport.receipt?.verifiedWorkflow?.proofStatus).toBe('missing');
expect(changedReport.verifiedWorkflow?.reviewerDecision).toBe('needs-focused-review');
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
npm test -- tests/core/prove.test.ts tests/cli/prove.test.ts tests/mcp/prove.test.ts
```

Expected: fail because `verifiedWorkflow` does not exist.

- [ ] **Step 3: Add additive types and builders**

Add `ProveVerifiedWorkflow` and populate it from contract, record, and receipt report builders. Do not remove existing fields.

- [ ] **Step 4: Render compact CLI sections**

Console and Markdown should show:

```text
Verified Workflow
- next action: ...
- next command: ...
```

- [ ] **Step 5: Run tests and verify green**

Run:

```bash
npm test -- tests/core/prove.test.ts tests/cli/prove.test.ts tests/mcp/prove.test.ts
```

Expected: pass.

### Task 3: Update Docs And Decision Log

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/STABILITY.md`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`
- Modify: `DECISIONS.md`
- Test: `tests/docs/proveDocs.test.ts`

- [ ] **Step 1: Write failing docs test**

Require docs to mention `Verified Workflow`, `verifiedWorkflow`, and the `start -> prove -> record -> changed` path.

- [ ] **Step 2: Run docs test and verify red**

Run:

```bash
npm test -- tests/docs/proveDocs.test.ts
```

Expected: fail until docs are updated.

- [ ] **Step 3: Update prose with stop-slop rules**

Keep docs concrete. Avoid claims that imply automatic fixing, remote review, or release automation.

- [ ] **Step 4: Run docs test and verify green**

Run:

```bash
npm test -- tests/docs/proveDocs.test.ts
```

Expected: pass.

### Task 4: Full Bug, Security, And Performance Pass

**Files:**
- No planned code files unless verification finds a bug.

- [ ] **Step 1: Run focused verification**

```bash
npm test -- tests/core/prove.test.ts tests/cli/prove.test.ts tests/mcp/prove.test.ts tests/core/intentRouter.test.ts tests/cli/startIntentRouting.test.ts tests/docs/proveDocs.test.ts
```

- [ ] **Step 2: Run quality gates**

```bash
npm run typecheck
npm run lint
npm run build
```

- [ ] **Step 3: Run security pass**

```bash
npm run security:release-gate
rg "child_process|exec\\(|spawn\\(|\\.arg\\(\\\"-c\\\"\\)|eval\\(|Function\\(" src/core/prove.ts src/cli/commands/prove.ts src/core/startRouteActions.ts src/mcp/tools/prove.ts
```

Expected: no new command execution path.

- [ ] **Step 4: Run performance pass**

```bash
node dist/cli/index.js prove --intent "is my agent allowed to change billing retry logic" --format json --quiet >/tmp/projscan-prove-perf.json
/usr/bin/time -l node dist/cli/index.js route --intent "is my agent allowed to change billing retry logic" --format json --quiet >/tmp/projscan-route-perf.json
```

Expected: commands complete without excessive memory or noisy output.

- [ ] **Step 5: Run AgentLoop task verification**

```bash
npm exec agentloop -- verify --task .agentloop/tasks/2026-06-24-verified-change-workflow.md --task-commands --only-task-commands --write-run
npm exec agentloop -- check-gates
npm exec agentloop -- ship
```

Expected: pass or explicit documented warnings. Do not release.
