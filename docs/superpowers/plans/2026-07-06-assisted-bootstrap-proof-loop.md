# Assisted Bootstrap Proof Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit `--bootstrap-contract` support to `projscan proof-broker` and `projscan review-gate` so both review surfaces can write the next scoped Proof Contract on demand and immediately pivot to the post-bootstrap proof loop.

**Architecture:** Keep one contract writer. `proof-broker` and `review-gate` should call the existing `computeProve(..., { intent, saveContractPath })` path to mint the contract, then rerun their normal report builders against the written contract path. The new behavior stays additive: existing `recontract` guidance remains, and a new `bootstrap` report field records the explicit write outcome.

**Tech Stack:** TypeScript, Commander CLI, Vitest, existing `computeProve` / passport / proof-broker / review-gate core pipeline

---

## File Structure

- Modify: `src/types/prove.ts`
  - Reuse `ProveReport.savedContractPath`; confirm the bootstrap plan consumes the existing saved-path signal instead of creating a second contract-write report type in prove.
- Modify: `src/types/proofBroker.ts`
  - Add shared bootstrap result types and optional `bootstrap` field on `ProofBrokerReport`.
- Modify: `src/types/reviewGate.ts`
  - Reuse the shared bootstrap result type and add optional `bootstrap` field on `ReviewGateReport`.
- Modify: `src/core/proofBroker.ts`
  - Add bootstrap orchestration and post-bootstrap rerun for broker reports.
- Modify: `src/core/reviewGate.ts`
  - Reuse the broker bootstrap path and add gate-specific follow-up commands / markdown.
- Modify: `src/cli/commands/proofBroker.ts`
  - Add `--bootstrap-contract` validation and print the new console/markdown behavior.
- Modify: `src/cli/commands/reviewGate.ts`
  - Add `--bootstrap-contract` validation and print the new console/markdown behavior.
- Modify: `tests/core/proofBroker.test.ts`
  - Add core bootstrap tests for broker write behavior, default/explicit paths, and missing-intent validation.
- Modify: `tests/core/reviewGate.test.ts`
  - Add core bootstrap tests for gate write behavior and post-bootstrap next-command pivot.
- Modify: `tests/cli/proofBroker.test.ts`
  - Add CLI tests for `--bootstrap-contract` JSON, console, and markdown flows.
- Modify: `tests/cli/reviewGate.test.ts`
  - Add CLI tests for `--bootstrap-contract` JSON, console, markdown, and CI-adjacent guardrails.
- Modify: `tests/docs/proveDocs.test.ts`
  - Lock the new command examples into the public docs/tests.
- Modify: `docs/GUIDE.md`
  - Document explicit bootstrap behavior, flags, and non-goals.
- Modify: `README.md`
  - Update quickstart and proof/review sections to show the new reviewer-facing bootstrap path.
- Optional if public wording changes materially: `DECISIONS.md`
  - Record the deliberate shift from advisory-only recontract to explicit write-assisted bootstrap.

### Task 1: Add Shared Bootstrap Report Types And Broker Core Flow

**Files:**
- Modify: `src/types/proofBroker.ts`
- Modify: `src/core/proofBroker.ts`
- Test: `tests/core/proofBroker.test.ts`

- [ ] **Step 1: Write failing broker-core tests for bootstrap mode**

Add these tests near the existing recontract coverage in `tests/core/proofBroker.test.ts`:

```ts
test('proof-broker bootstrap writes the default contract and reports bootstrap metadata', async () => {
  const report = await computeProofBroker(tmp, {
    intent: 'is my agent allowed to change billing retry logic?',
    bootstrapContract: true,
    proofRecipes: [
      {
        id: 'billing-retry-safety',
        matches: ['src/billing/**'],
        requiredCommands: ['npm run test:billing', 'npm run typecheck'],
        requiredReviewers: ['@billing-platform'],
        forbiddenFiles: ['src/billing/paymentGateway.ts'],
        riskSurface: 'billing',
        reason: 'Billing retry changes need focused regression proof and platform review.',
      },
    ],
  });

  expect(report.bootstrap).toEqual({
    attempted: true,
    wroteContract: true,
    contractPath: '.projscan/proof-contract.json',
    intent: 'is my agent allowed to change billing retry logic?',
    summary: expect.stringContaining('Proof Contract'),
    followUpCommands: expect.arrayContaining([
      'npm run test:billing',
      'npm run typecheck',
      'projscan prove --changed --contract .projscan/proof-contract.json --format markdown',
      'projscan proof-broker --contract .projscan/proof-contract.json --pr-comment',
    ]),
  });
  expect(report.artifacts.contractPath).toBe('.projscan/proof-contract.json');
});

test('proof-broker bootstrap preserves explicit save-contract paths', async () => {
  const report = await computeProofBroker(tmp, {
    intent: 'is my agent allowed to change billing retry logic?',
    bootstrapContract: true,
    saveContractPath: '.projscan/proof-contracts/billing-retry.json',
  });

  expect(report.bootstrap?.contractPath).toBe('.projscan/proof-contracts/billing-retry.json');
  expect(report.recontract.recommendedContractPath).toBe('.projscan/proof-contracts/billing-retry.json');
});

test('proof-broker bootstrap requires intent', async () => {
  await expect(
    computeProofBroker(tmp, {
      bootstrapContract: true,
    }),
  ).rejects.toThrow('proof-broker --bootstrap-contract requires --intent');
});
```

- [ ] **Step 2: Run the broker-core tests to verify they fail**

Run:

```bash
npm test -- --runInBand tests/core/proofBroker.test.ts
```

Expected: FAIL with type/runtime errors because `bootstrapContract` and `report.bootstrap` do not exist yet.

- [ ] **Step 3: Add the shared broker bootstrap type**

In `src/types/proofBroker.ts`, add:

```ts
export interface BootstrapContractResult {
  attempted: boolean;
  wroteContract: boolean;
  contractPath?: string;
  intent: string;
  summary?: string;
  followUpCommands: string[];
}
```

Then add the new option and report fields:

```ts
export interface ComputeProofBrokerOptions {
  intent?: string;
  contractPath?: string;
  saveContractPath?: string;
  bootstrapContract?: boolean;
  // existing fields stay unchanged
}

export interface ProofBrokerReport {
  // existing fields stay unchanged
  bootstrap?: BootstrapContractResult;
}
```

- [ ] **Step 4: Implement broker bootstrap by reusing `computeProve`**

In `src/core/proofBroker.ts`, import `computeProve` and structure the flow around one helper:

```ts
async function bootstrapBrokerContract(
  rootPath: string,
  options: ComputeProofBrokerOptions,
): Promise<{ contractPath: string; bootstrap: BootstrapContractResult }> {
  if (!options.intent?.trim()) {
    throw new Error('proof-broker --bootstrap-contract requires --intent');
  }

  const prove = await computeProve(rootPath, {
    intent: options.intent,
    saveContractPath: options.saveContractPath ?? DEFAULT_CONTRACT_PATH,
    maxFiles: options.maxFiles,
    feedbackPath: options.feedbackPath,
    baseRef: options.baseRef,
    proofRecipes: options.proofRecipes,
  });

  const contractPath = prove.savedContractPath ?? options.saveContractPath ?? DEFAULT_CONTRACT_PATH;
  return {
    contractPath,
    bootstrap: {
      attempted: true,
      wroteContract: true,
      contractPath,
      intent: options.intent,
      summary: prove.summary,
      followUpCommands: [
        ...prove.commands,
        `projscan prove --changed --contract ${quoteShellArg(contractPath)} --format markdown`,
        `projscan passport --contract ${quoteShellArg(contractPath)} --format markdown`,
        `projscan proof-broker --contract ${quoteShellArg(contractPath)} --pr-comment`,
      ],
    },
  };
}
```

Then change `computeProofBroker()` so it:

```ts
if (options.bootstrapContract) {
  const { contractPath, bootstrap } = await bootstrapBrokerContract(rootPath, options);
  const passport = await computePassport(rootPath, {
    contractPath,
    outputPath: options.outputPassportPath,
    maxFiles: options.maxFiles,
    feedbackPath: options.feedbackPath,
    baseRef: options.baseRef,
    ledgerPath: options.ledgerPath,
    proofRecipes: options.proofRecipes,
  });
  return buildProofBrokerReport(passport, { ...options, contractPath, saveContractPath: contractPath }, bootstrap);
}
```

And extend `buildProofBrokerReport(...)` to attach:

```ts
...(bootstrap ? { bootstrap } : {})
```

- [ ] **Step 5: Run the broker-core tests to verify they pass**

Run:

```bash
npm test -- --runInBand tests/core/proofBroker.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the broker core slice**

```bash
git add src/types/proofBroker.ts src/core/proofBroker.ts tests/core/proofBroker.test.ts
git commit -m "feat: add proof broker bootstrap flow"
```

### Task 2: Add Review Gate Bootstrap Integration And Shared Follow-Up Semantics

**Files:**
- Modify: `src/types/reviewGate.ts`
- Modify: `src/core/reviewGate.ts`
- Test: `tests/core/reviewGate.test.ts`

- [ ] **Step 1: Write failing review-gate core tests**

Add tests in `tests/core/reviewGate.test.ts`:

```ts
test('review-gate bootstrap writes a contract and reports bootstrap metadata', async () => {
  await changeBillingRetryPolicy();

  const report = await computeReviewGate(tmp, {
    intent: 'is my agent allowed to change billing retry logic?',
    bootstrapContract: true,
    proofRecipes,
  });

  expect(report.bootstrap).toEqual({
    attempted: true,
    wroteContract: true,
    contractPath: '.projscan/proof-contract.json',
    intent: 'is my agent allowed to change billing retry logic?',
    summary: expect.stringContaining('Proof Contract'),
    followUpCommands: expect.arrayContaining([
      'npm run test:billing',
      'projscan prove --changed --contract .projscan/proof-contract.json --format markdown',
      'projscan review-gate --contract .projscan/proof-contract.json --pr-comment',
    ]),
  });
  expect(report.recontract.followUpCommands).not.toContain(
    'projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json',
  );
});

test('review-gate bootstrap requires intent', async () => {
  await expect(
    computeReviewGate(tmp, {
      bootstrapContract: true,
      proofRecipes,
    }),
  ).rejects.toThrow('review-gate --bootstrap-contract requires --intent');
});
```

- [ ] **Step 2: Run the review-gate core tests to verify they fail**

Run:

```bash
npm test -- --runInBand tests/core/reviewGate.test.ts
```

Expected: FAIL because `bootstrapContract` and `report.bootstrap` do not exist on review-gate paths.

- [ ] **Step 3: Add the review-gate option and report field**

In `src/types/reviewGate.ts`, add:

```ts
import type { BootstrapContractResult } from './proofBroker.js';
```

Then extend the option and report types:

```ts
export interface ComputeReviewGateOptions {
  intent?: string;
  contractPath?: string;
  saveContractPath?: string;
  bootstrapContract?: boolean;
  // existing fields stay unchanged
}

export interface ReviewGateReport {
  // existing fields stay unchanged
  bootstrap?: BootstrapContractResult;
}
```

- [ ] **Step 4: Route review-gate bootstrap through proof-broker bootstrap**

In `src/core/reviewGate.ts`, keep one bootstrap write path by calling `computeProofBroker()` first:

```ts
const proofBroker = await computeProofBroker(root, {
  intent: options.intent,
  contractPath: options.contractPath,
  saveContractPath: options.saveContractPath,
  bootstrapContract: options.bootstrapContract,
  outputPassportPath: options.outputPassportPath,
  maxFiles: options.maxFiles,
  feedbackPath: options.feedbackPath,
  baseRef: options.baseRef,
  ledgerPath: options.ledgerPath,
  proofRecipes: options.proofRecipes,
});
```

Then attach bootstrap metadata in `buildReviewGateReport(...)`:

```ts
...(proofBroker.bootstrap ? { bootstrap: proofBroker.bootstrap } : {})
```

And ensure gate follow-up commands stay gate-shaped:

```ts
function recontractGuidanceFor(
  proofBroker: ProofBrokerReport,
  contractPath: string,
): ReviewGateRecontractGuidance {
  return {
    ...proofBroker.recontract,
    followUpCommands: unique([
      ...proofBroker.recontract.followUpCommands.filter(
        (command) => !command.startsWith('projscan proof-broker --contract '),
      ),
      `projscan proof-broker --contract ${quoteShellArg(contractPath)} --pr-comment`,
      `projscan review-gate --contract ${quoteShellArg(contractPath)} --pr-comment`,
    ]),
  };
}
```

- [ ] **Step 5: Run the review-gate core tests to verify they pass**

Run:

```bash
npm test -- --runInBand tests/core/reviewGate.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the review-gate core slice**

```bash
git add src/types/reviewGate.ts src/core/reviewGate.ts tests/core/reviewGate.test.ts
git commit -m "feat: add review gate bootstrap reporting"
```

### Task 3: Add CLI Flags, Renderers, And Public Contract Docs

**Files:**
- Modify: `src/cli/commands/proofBroker.ts`
- Modify: `src/cli/commands/reviewGate.ts`
- Modify: `tests/cli/proofBroker.test.ts`
- Modify: `tests/cli/reviewGate.test.ts`
- Modify: `tests/docs/proveDocs.test.ts`
- Modify: `docs/GUIDE.md`
- Modify: `README.md`

- [ ] **Step 1: Write failing CLI and docs tests**

Add CLI assertions in `tests/cli/proofBroker.test.ts`:

```ts
test('proof-broker bootstrap renders JSON, markdown, and console bootstrap sections', async () => {
  const json = await runCli([
    'proof-broker',
    '--intent',
    'is my agent allowed to change billing retry logic?',
    '--bootstrap-contract',
    '--format',
    'json',
    '--quiet',
  ]);

  const report = JSON.parse(json.stdout);
  expect(report.bootstrap.contractPath).toBe('.projscan/proof-contract.json');

  const consoleResult = await runCli([
    'proof-broker',
    '--contract',
    '.projscan/proof-contract.json',
    '--quiet',
  ]);
  expect(consoleResult.stdout).toContain('Bootstrap');
});
```

Add CLI assertions in `tests/cli/reviewGate.test.ts`:

```ts
test('review-gate bootstrap requires intent', async () => {
  const result = await runCli([
    'review-gate',
    '--bootstrap-contract',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain('review-gate --bootstrap-contract requires --intent');
});
```

Add doc assertions in `tests/docs/proveDocs.test.ts`:

```ts
expect(readme).toContain('projscan proof-broker --intent "<change>" --bootstrap-contract');
expect(readme).toContain('projscan review-gate --intent "<change>" --bootstrap-contract');
expect(guide).toContain('--bootstrap-contract');
expect(guide).toContain('writes a new Proof Contract only when explicitly requested');
```

- [ ] **Step 2: Run the CLI/docs tests to verify they fail**

Run:

```bash
npm test -- --runInBand tests/cli/proofBroker.test.ts tests/cli/reviewGate.test.ts tests/docs/proveDocs.test.ts
```

Expected: FAIL because the new flag and docs text do not exist yet.

- [ ] **Step 3: Add the CLI flag and validation**

In both `src/cli/commands/proofBroker.ts` and `src/cli/commands/reviewGate.ts`, add:

```ts
.option('--bootstrap-contract', 'write a new Proof Contract before building the review surface')
```

Pass it through:

```ts
bootstrapContract: cmdOpts.bootstrapContract,
```

And reject invalid flag combinations before calling the core functions:

```ts
if (cmdOpts.bootstrapContract && !cmdOpts.intent?.trim()) {
  throw new Error('proof-broker --bootstrap-contract requires --intent');
}
if (cmdOpts.bootstrapContract && cmdOpts.contract) {
  throw new Error('proof-broker --bootstrap-contract cannot be used with --contract; use --save-contract to choose the output path');
}
```

Mirror the same shape in `reviewGate.ts`, with `review-gate` in the message text.

- [ ] **Step 4: Render the Bootstrap section in console and markdown paths**

In `src/cli/commands/proofBroker.ts`, add:

```ts
if (report.bootstrap) {
  console.log('');
  console.log(chalk.bold('Bootstrap'));
  console.log(`- attempted: ${report.bootstrap.attempted ? 'yes' : 'no'}`);
  console.log(`- wrote contract: ${report.bootstrap.wroteContract ? 'yes' : 'no'}`);
  console.log(`- contract path: ${report.bootstrap.contractPath ?? 'none'}`);
  console.log(`- intent: ${report.bootstrap.intent}`);
  console.log('- next commands:');
  printList(report.bootstrap.followUpCommands.slice(0, 10), 'No bootstrap commands');
}
```

In `src/core/proofBroker.ts` markdown rendering, add:

```md
### Bootstrap
- **Attempted:** yes
- **Wrote contract:** yes
- **Contract path:** `.projscan/proof-contract.json`
- **Intent:** is my agent allowed to change billing retry logic?
```

Mirror the same section for `review-gate` console and `renderReviewGateMarkdown(...)`.

- [ ] **Step 5: Update docs to advertise explicit bootstrap without implying automation**

Update `docs/GUIDE.md` and `README.md` so the examples show:

```bash
projscan proof-broker --intent "<change>" --bootstrap-contract
projscan review-gate --intent "<change>" --bootstrap-contract
```

And add one explicit guardrail sentence in each doc:

```md
`--bootstrap-contract` writes a Proof Contract only when explicitly requested. It does not execute proof commands and does not silently widen scope.
```

- [ ] **Step 6: Run the CLI/docs tests to verify they pass**

Run:

```bash
npm test -- --runInBand tests/cli/proofBroker.test.ts tests/cli/reviewGate.test.ts tests/docs/proveDocs.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the CLI/docs slice**

```bash
git add src/cli/commands/proofBroker.ts src/cli/commands/reviewGate.ts tests/cli/proofBroker.test.ts tests/cli/reviewGate.test.ts tests/docs/proveDocs.test.ts docs/GUIDE.md README.md
git commit -m "feat: expose bootstrap contract review commands"
```

### Task 4: Bug Pass, Linked-Worktree Dogfood, And Release-Handoff Prep

**Files:**
- Modify if needed: `src/core/proofBroker.ts`
- Modify if needed: `src/core/reviewGate.ts`
- Modify if needed: `src/cli/commands/proofBroker.ts`
- Modify if needed: `src/cli/commands/reviewGate.ts`
- Modify if needed: `DECISIONS.md`
- Verification target: `.agentloop/tasks/2026-07-06-assisted-bootstrap-proof-loop.md`

- [ ] **Step 1: Run the focused feature suite**

Run:

```bash
npm test -- --runInBand tests/core/proofBroker.test.ts tests/core/reviewGate.test.ts tests/cli/proofBroker.test.ts tests/cli/reviewGate.test.ts tests/docs/proveDocs.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run repo checks required by the task contract**

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Expected: PASS for all three commands.

- [ ] **Step 3: Dogfood the bootstrap flow in the linked proof worktree**

Run from repo root:

```bash
node dist/cli/index.js proof-broker \
  --worktree .worktrees/agentloopkit-proof-phase-upgrade-train \
  --intent "bootstrap the next scoped proof contract for the proof-phase train" \
  --bootstrap-contract \
  --format json
```

Then rerun gate evidence against the written contract:

```bash
node dist/cli/index.js review-gate \
  --worktree .worktrees/agentloopkit-proof-phase-upgrade-train \
  --contract .projscan/proof-contract.json \
  --format json
```

Expected:

```text
- proof-broker JSON includes bootstrap.contractPath
- proof-broker JSON includes recontract and bootstrap side by side
- review-gate JSON reads the written contract
- the worktree may still be drifted, but it is no longer missing-contract
```

- [ ] **Step 4: Fix any bug-pass findings before handoff**

If the dogfood pass shows renderer mismatches, stale built output, or command-order inconsistencies, make only bounded fixes in the touched broker/gate files and rerun the exact failing checks before proceeding.

- [ ] **Step 5: Record any architecture/public-behavior decision**

If the implementation changes the public semantics beyond the approved spec, add a short entry to `DECISIONS.md` such as:

```md
## 2026-07-06 - Explicit bootstrap on review surfaces

- Added `--bootstrap-contract` to `proof-broker` and `review-gate`.
- Kept contract creation explicit and local.
- Reused `computeProve()` as the only Proof Contract writer.
```

- [ ] **Step 6: Run AgentLoop verification and review gates**

Run:

```bash
npm exec agentloop -- verify --task .agentloop/tasks/2026-07-06-assisted-bootstrap-proof-loop.md --task-commands --only-task-commands --write-run
npm exec agentloop -- check-gates
npm exec agentloop -- ship
```

Expected: verification report written, gates passing or explicitly explained.

- [ ] **Step 7: Commit final bug-pass/doc adjustments**

```bash
git add .
git commit -m "fix: harden bootstrap proof loop handoff"
```

## Self-Review

- Spec coverage:
  - explicit bootstrap on both surfaces: Tasks 1-3
  - shared writer reuse: Tasks 1-2
  - console/json/markdown output: Task 3
  - focused tests and linked-worktree dogfood: Task 4
  - no release cut in this slice: task contract + Task 4
- Placeholder scan:
  - No `TBD`, `TODO`, or deferred “write tests later” steps remain.
- Type consistency:
  - `BootstrapContractResult`, `bootstrapContract`, and `bootstrap` are used consistently across the plan.
