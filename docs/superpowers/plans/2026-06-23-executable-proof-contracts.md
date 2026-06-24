# Executable Proof Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `projscan prove` as a local Proof Contract and Proof Receipt workflow for proposed and completed changes.

**Architecture:** Add a focused `src/core/prove.ts` composer that reuses `computeSimulation`, `computePreflight`, optional feedback memory, and changed-file utilities. Add `src/types/prove.ts`, `src/cli/commands/prove.ts`, and `src/mcp/tools/prove.ts` as thin adapters. Keep the command additive, local-first, and read-only unless `--save-contract` is explicitly supplied.

**Tech Stack:** TypeScript, Commander CLI, Vitest, existing MCP tool registry, existing projscan core analyzers.

---

## File Structure

- Create `src/types/prove.ts`: public Proof Contract, Proof Receipt, and report types.
- Create `src/core/prove.ts`: intent contract generation, changed validation, optional contract read/write, and Markdown-safe receipt data.
- Create `src/cli/commands/prove.ts`: CLI options, format rendering, and error messages.
- Create `src/mcp/tools/prove.ts`: MCP schema and handler.
- Modify `src/cli/registerCommands.ts`: register `prove`.
- Modify `src/mcp/toolCatalog.ts`: register `projscan_prove`.
- Modify `src/types.ts`: export prove types.
- Modify `src/publicCore.ts`: export `computeProve`.
- Modify `src/utils/formatSupport.ts`: add `prove` formats.
- Create `tests/core/prove.test.ts`: core contract and receipt tests.
- Create `tests/cli/prove.test.ts`: CLI format and save/read tests.
- Create `tests/mcp/prove.test.ts`: MCP tool tests.
- Modify `README.md`, `docs/GUIDE.md`, and `docs/WEBSITE-UPDATE-PROMPT.md`: document the new pillar.
- Modify `DECISIONS.md`: record public behavior decision.

## Task 1: Core Types And Failing Core Tests

**Files:**
- Create: `src/types/prove.ts`
- Create: `tests/core/prove.test.ts`

- [ ] **Step 1: Write the public type skeleton**

```ts
export type ProveMode = 'intent' | 'changed';
export type ProveVerdict = 'ready' | 'needs-review' | 'blocked';
export type ProveScopeStatus = 'within-contract' | 'drifted' | 'missing-contract';
```

- [ ] **Step 2: Write failing core tests**

```ts
test('builds an executable contract from an intent', async () => {
  const report = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  expect(report.mode).toBe('intent');
  expect(report.contract?.allowedFiles).toContain('src/core/bugHunt.ts');
  expect(report.contract?.likelyTests).toContain('tests/core/bugHunt.test.ts');
  expect(report.contract?.proofCommands).toContain(
    'projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules" --format json',
  );
  expect(report.contract?.receiptCommand).toContain('projscan prove --changed');
});

test('validates changed files against a saved contract', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });
  expect(report.mode).toBe('changed');
  expect(report.receipt?.scope.status).toBe('within-contract');
  expect(report.receipt?.commitReadiness).toMatch(/ready|needs-review/);
});

test('flags forbidden scope drift', async () => {
  const contractReport = await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
  });
  await fs.writeFile(path.join(tmp, 'package.json'), '{"name":"changed"}\n');
  const report = await computeProve(tmp, {
    changed: true,
    contract: contractReport.contract,
  });
  expect(report.receipt?.scope.status).toBe('drifted');
  expect(report.receipt?.scope.forbiddenTouched).toContain('package.json');
});
```

- [ ] **Step 3: Run the tests and verify RED**

Run: `npm test -- tests/core/prove.test.ts`

Expected: fails because `src/core/prove.ts` does not exist.

## Task 2: Core Implementation

**Files:**
- Create: `src/core/prove.ts`
- Modify: `src/types/prove.ts`
- Modify: `src/types.ts`
- Modify: `src/publicCore.ts`

- [ ] **Step 1: Implement minimal core composition**

Use `computeSimulation`, `computePreflight`, `readFeedbackFile`, and `getChangedFiles`. Keep `projscan assess --mode fix-first --format json` as a proof command instead of blocking intent mode on the full weekly assessment path.

- [ ] **Step 2: Implement scope rules**

Allowed files come from simulation candidates and Proof Cards. Forbidden files include generated/cache paths, release metadata, secret-bearing paths, and public surfaces not named by the plan.

- [ ] **Step 3: Implement receipt readiness**

`blocked` when forbidden files are touched or preflight blocks. `needs-review` when no contract is applied, proof is missing, or scope drifts. `ready` only when scope is within contract and preflight proceeds.

- [ ] **Step 4: Run core tests and verify GREEN**

Run: `npm test -- tests/core/prove.test.ts`

Expected: all core prove tests pass.

## Task 3: CLI Tests And Command

**Files:**
- Create: `tests/cli/prove.test.ts`
- Create: `src/cli/commands/prove.ts`
- Modify: `src/cli/registerCommands.ts`
- Modify: `src/utils/formatSupport.ts`

- [ ] **Step 1: Write failing CLI tests**

```ts
test('prove intent renders JSON', async () => {
  const result = await runCli(['prove', '--intent', 'split bugHunt.ts into ranking', '--format', 'json', '--quiet']);
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout).contract.allowedFiles).toContain('src/core/bugHunt.ts');
});

test('prove changed reads a saved contract', async () => {
  const save = await runCli(['prove', '--intent', 'split bugHunt.ts into ranking', '--save-contract', '.projscan/proof-contract.json', '--format', 'json', '--quiet']);
  expect(save.exitCode).toBe(0);
  const changed = await runCli(['prove', '--changed', '--contract', '.projscan/proof-contract.json', '--format', 'markdown', '--quiet']);
  expect(changed.stdout).toContain('# Projscan Proof Receipt');
});
```

- [ ] **Step 2: Run CLI tests and verify RED**

Run: `npm run build && npm test -- tests/cli/prove.test.ts`

Expected: fails because `prove` is not registered.

- [ ] **Step 3: Implement CLI command and renderers**

Add options: `--intent`, `--changed`, `--contract`, `--save-contract`, `--max-files`, `--feedback`.

- [ ] **Step 4: Run CLI tests and verify GREEN**

Run: `npm run build && npm test -- tests/cli/prove.test.ts`

Expected: all CLI prove tests pass.

## Task 4: MCP Tests And Tool

**Files:**
- Create: `tests/mcp/prove.test.ts`
- Create: `src/mcp/tools/prove.ts`
- Modify: `src/mcp/toolCatalog.ts`

- [ ] **Step 1: Write failing MCP tests**

```ts
test('lists projscan_prove MCP tool', () => {
  const tool = getToolDefinitions().find((entry) => entry.name === 'projscan_prove');
  expect(tool?.inputSchema.properties?.intent.description).toContain('change intent');
});

test('projscan_prove returns a contract', async () => {
  const handler = getToolHandler('projscan_prove');
  const result = await handler?.({ intent: 'split bugHunt.ts into ranking' }, tmp);
  expect(result.prove.contract.allowedFiles).toContain('src/core/bugHunt.ts');
});
```

- [ ] **Step 2: Run MCP tests and verify RED**

Run: `npm test -- tests/mcp/prove.test.ts`

Expected: fails because `projscan_prove` is not registered.

- [ ] **Step 3: Implement MCP tool**

Map snake_case MCP inputs into `computeProve` options and return `{ prove: report }`.

- [ ] **Step 4: Run MCP tests and verify GREEN**

Run: `npm test -- tests/mcp/prove.test.ts`

Expected: all MCP prove tests pass.

## Task 5: Bug Pass

**Files:**
- Inspect changed implementation files and focused tests.

- [ ] **Step 1: Run targeted proof-contract suite**

Run: `npm test -- tests/core/prove.test.ts tests/cli/prove.test.ts tests/mcp/prove.test.ts`

- [ ] **Step 2: Dogfood the command**

Run: `npm run build`

Run: `node dist/cli/index.js prove --intent "is my agent allowed to change billing retry logic?" --format json`

Run: `node dist/cli/index.js prove --changed --format json`

- [ ] **Step 3: Fix any bug found with a failing test first**

Add regression tests to the focused prove test files before fixing.

## Task 6: Docs And Marketing Pass

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`
- Modify: `DECISIONS.md`

- [ ] **Step 1: Update README daily workflows**

Add Proof Contracts beside Proof Cards:

```bash
projscan prove --intent "is my agent allowed to change billing retry logic?"
projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json
projscan prove --changed --contract .projscan/proof-contract.json --format markdown
```

- [ ] **Step 2: Update docs guide**

Document intent mode, changed mode, saved contracts, receipts, and MCP.

- [ ] **Step 3: Update website prompt**

Add a future-release section without bumping version labels or implying release.

## Task 7: Performance And Release-Readiness Verification

**Files:**
- No code edits unless verification exposes a bug.

- [ ] **Step 1: Measure command latency**

Run: `time node dist/cli/index.js prove --intent "split bugHunt.ts into ranking, evidence, and output modules" --format json --quiet >/tmp/projscan-prove-intent.json`

Run: `time node dist/cli/index.js prove --changed --format json --quiet >/tmp/projscan-prove-changed.json`

- [ ] **Step 2: Run broad checks**

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm run build`

- [ ] **Step 3: Run AgentLoop task verification**

Run: `npm exec agentloop -- verify --task .agentloop/tasks/2026-06-23-executable-proof-contracts.md --task-commands --only-task-commands --write-run`

- [ ] **Step 4: Run gates and handoff**

Run: `npm exec agentloop -- check-gates`

Run: `npm exec agentloop -- ship`

Stop for user release approval. Do not release, tag, publish, deploy, push, merge, or bump versions.
