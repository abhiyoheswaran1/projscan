# Agent Change Passport And Live Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-command Agent Change Passport and a live scope guard that turn ProjScan Proof Contracts and Proof Receipts into reviewer-ready local evidence.

**Architecture:** Keep the new feature as an orchestration layer over `computeProve()`. `passport` builds or loads a Proof Contract, replays the current working tree into a receipt, summarizes proof status, and can write a local passport JSON artifact. `guard` evaluates the same receipt through stricter drift rules and offers a polling watch mode without executing proof commands or mutating files.

**Tech Stack:** TypeScript, Node.js standard library, Commander CLI, existing ProjScan proof modules, Vitest.

---

### Task 1: Passport Core

**Files:**
- Create: `src/types/passport.ts`
- Create: `src/core/passport.ts`
- Test: `tests/core/passport.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test('builds a passport from an intent and current receipt', async () => {
  const passport = await computePassport(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
    saveContractPath: '.projscan/proof-contract.json',
  });

  expect(passport.kind).toBe('agent-change-passport');
  expect(passport.intent).toContain('split bugHunt');
  expect(passport.boundary.allowedFiles).toContain('src/core/bugHunt.ts');
  expect(passport.receipt.scopeStatus).toBe('within-contract');
  expect(passport.receipt.proofStatus).toMatch(/missing|not-run/);
  expect(passport.reviewer.action).toBe('run-proof');
  expect(passport.nextCommands).toContain('projscan prove --changed --contract .projscan/proof-contract.json --format markdown');
});
```

Run: `npm test -- tests/core/passport.test.ts`
Expected: FAIL because `src/core/passport.ts` does not exist.

- [ ] **Step 2: Implement the passport summary**

```ts
export async function computePassport(
  rootPath: string,
  options: ComputePassportOptions,
): Promise<AgentChangePassport> {
  const contractReport = options.intent
    ? await computeProve(rootPath, {
        intent: options.intent,
        saveContractPath: options.saveContractPath,
        maxFiles: options.maxFiles,
        feedbackPath: options.feedbackPath,
        baseRef: options.baseRef,
        proofRecipes: options.proofRecipes,
      })
    : undefined;
  const changedReport = await computeProve(rootPath, {
    changed: true,
    contract: contractReport?.contract,
    contractPath: options.contractPath,
    ledgerPath: options.ledgerPath,
    baseRef: options.baseRef,
  });
  return buildPassport(contractReport, changedReport, options);
}
```

Run: `npm test -- tests/core/passport.test.ts`
Expected: PASS for the first passport behavior.

- [ ] **Step 3: Add artifact write safety tests**

```ts
test('writes only passport artifacts under .projscan', async () => {
  const passport = await computePassport(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
    outputPath: '.projscan/passport.json',
  });

  const saved = JSON.parse(await fs.readFile(path.join(tmp, '.projscan/passport.json'), 'utf-8'));
  expect(saved.kind).toBe('agent-change-passport');
  expect(passport.artifacts.passportPath).toBe('.projscan/passport.json');
});
```

Run: `npm test -- tests/core/passport.test.ts`
Expected: FAIL until artifact writing validates path and existing file shape.

- [ ] **Step 4: Implement safe artifact writes**

Use `prepareProofArtifactWritePath()` and `atomicWriteFile()`. Accept only `.projscan/passport.json` and `.projscan/passports/<name>.json`. Refuse to overwrite a file unless it has `kind: "agent-change-passport"`.

Run: `npm test -- tests/core/passport.test.ts`
Expected: PASS.

### Task 2: Guard Core

**Files:**
- Create: `src/types/guard.ts`
- Create: `src/core/guard.ts`
- Test: `tests/core/guard.test.ts`

- [ ] **Step 1: Write failing guard tests**

```ts
test('reports scope drift for forbidden or unexpected files', async () => {
  const guard = await computeGuard(tmp, {
    contractPath: '.projscan/proof-contract.json',
  });

  expect(guard.status).toBe('drift');
  expect(guard.exitCode).toBe(2);
  expect(guard.drift.files).toContain('package.json');
});
```

Run: `npm test -- tests/core/guard.test.ts`
Expected: FAIL because `computeGuard()` does not exist.

- [ ] **Step 2: Implement guard evaluation**

`computeGuard()` calls `computeProve(root, { changed: true })`, reads the receipt, and returns `clear`, `attention`, `drift`, or `blocked`. It must not write files or run proof commands.

Run: `npm test -- tests/core/guard.test.ts`
Expected: PASS.

### Task 3: CLI And MCP Surfaces

**Files:**
- Create: `src/cli/commands/passport.ts`
- Create: `src/cli/commands/guard.ts`
- Modify: `src/cli/registerCommands.ts`
- Create: `src/mcp/tools/passport.ts`
- Modify: `src/mcp/toolCatalog.ts`
- Test: `tests/mcp/passport.test.ts`

- [ ] **Step 1: Add CLI registrations**

Expose:

```bash
projscan passport --intent "<task>" --save-contract .projscan/proof-contract.json --format markdown
projscan passport --contract .projscan/proof-contract.json --output .projscan/passport.json --format json
projscan guard --contract .projscan/proof-contract.json --fail-on-drift
projscan guard --contract .projscan/proof-contract.json --watch
```

Run: `npm run typecheck`
Expected: PASS after command registration compiles.

- [ ] **Step 2: Add MCP passport tool**

Expose `projscan_passport` with intent, contract path, save contract path, output path, base ref, ledger path, max files, and feedback path. Do not expose proof command execution.

Run: `npm test -- tests/mcp/passport.test.ts`
Expected: PASS.

### Task 4: Docs, Version, And Release Evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Update public docs**

Document `4.17.0: Agent Change Passport And Live Guard`. Use direct prose:

```text
ProjScan turns a task into a local change passport. Reviewers see the allowed files, forbidden files, changed files, proof status, stale proof, and the next command before they approve an agent handoff.
```

Run Stop Slop checks over public prose: remove throat-clearing, adverbs, passive voice, and em dashes.

- [ ] **Step 2: Verify and release**

Run:

```bash
npm test -- tests/core/passport.test.ts tests/core/guard.test.ts tests/core/prove.test.ts tests/core/baseframeAssessment.test.ts tests/mcp/passport.test.ts
npm run typecheck
npm run lint
npm run build
npm exec agentloop -- verify --task .agentloop/tasks/2026-06-27-agent-change-passport-live-guard.md --task-commands --only-task-commands --write-run
npm exec agentloop -- check-gates
npm exec agentloop -- ship
npm exec agentloop -- release-notes --write
npm exec agentloop -- npm-status
```

Expected: all commands exit 0 before release claims. If publish credentials are unavailable, stop after package preparation and report the exact blocker.
