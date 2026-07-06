# Recontract Guidance Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `projscan proof-broker` and `projscan review-gate` emit worktree-aware, advisory recontract guidance with recommended intent, contract path, and ordered follow-up commands when proof is missing or scope has drifted.

**Architecture:** Extend the existing Proof Broker projection with a first-class recontract guidance object, then have Review Gate reuse that object rather than building its own parallel shape. Keep the behavior read-only: enrich JSON and Markdown output, preserve current path validation, and drive the implementation from focused core, CLI, and public-type tests.

**Tech Stack:** TypeScript, Vitest, Commander CLI, existing Proof Broker / Review Gate core modules, repo-local AgentLoopKit verification flow

---

## File Structure

- Modify: `src/types/proofBroker.ts`
  - Add the shared recontract guidance type and attach it to `ProofBrokerReport`.
- Modify: `src/types/reviewGate.ts`
  - Replace the minimal recontract shape with the richer shared shape or an alias to it.
- Modify: `src/core/proofBroker.ts`
  - Compute the richer recontract payload and render it in PR-passport Markdown.
- Modify: `src/core/reviewGate.ts`
  - Reuse Proof Broker recontract guidance, append any Review Gate-specific follow-up command, and render the richer section in PR-comment Markdown.
- Modify: `src/cli/commands/proofBroker.ts`
  - Print the richer recontract block in console mode.
- Modify: `src/cli/commands/reviewGate.ts`
  - Print the richer recontract block in console mode.
- Modify: `tests/core/proofBroker.test.ts`
  - Add missing-contract, explicit-intent, and explicit-contract-path recontract assertions.
- Modify: `tests/core/reviewGate.test.ts`
  - Add assertions that Review Gate reuses Proof Broker recontract guidance and preserves target-aware commands.
- Modify: `tests/cli/proofBroker.test.ts`
  - Add JSON and console assertions for the richer recontract block.
- Modify: `tests/cli/reviewGate.test.ts`
  - Add JSON and PR-comment assertions for the richer recontract block.
- Modify: `tests/types/public-proof-broker-types.test.ts`
  - Update sample report shape for the new recontract fields.
- Modify: `tests/types/public-review-gate-types.test.ts`
  - Update sample report shape for the new recontract fields.
- Modify: `docs/GUIDE.md`
  - Describe the new recontract recipe fields and advisory behavior.

## Task 1: Expand The Public Recontract Shape

**Files:**
- Modify: `src/types/proofBroker.ts`
- Modify: `src/types/reviewGate.ts`
- Test: `tests/types/public-proof-broker-types.test.ts`
- Test: `tests/types/public-review-gate-types.test.ts`

- [ ] **Step 1: Write the failing public-type tests**

Update the sample type fixtures so they require the richer recontract payload instead of the old `command`-only shape.

```ts
// tests/types/public-proof-broker-types.test.ts
const report: ProofBrokerReport = {
  // ...
  recontract: {
    required: true,
    reason: 'A Proof Contract is required before review.',
    target: {
      effectiveWorktreePath: '/tmp/projscan-proof',
      effectiveWorktreeBranch: 'agent-b',
      effectiveWorktreeHead: '0123456789abcdef0123456789abcdef01234567',
    },
    driftFiles: ['package.json'],
    recommendedIntent: 'change billing retry logic',
    recommendedContractPath: '.projscan/proof-contract.json',
    followUpCommands: [
      'projscan prove --intent "change billing retry logic" --save-contract .projscan/proof-contract.json',
      'projscan prove --changed --contract .projscan/proof-contract.json --format markdown',
    ],
  },
};
```

```ts
// tests/types/public-review-gate-types.test.ts
recontract: {
  required: false,
  reason: 'Current change is inside the approved boundary.',
  target: {
    effectiveWorktreePath: '/tmp/projscan-proof',
    effectiveWorktreeBranch: 'main',
    effectiveWorktreeHead: '0123456789abcdef0123456789abcdef01234567',
  },
  driftFiles: [],
  recommendedIntent: 'change billing retry logic',
  recommendedContractPath: '.projscan/proof-contract.json',
  followUpCommands: ['npm run test:billing'],
},
```

- [ ] **Step 2: Run the type fixture tests and verify they fail**

Run:

```bash
npm test -- tests/types/public-proof-broker-types.test.ts tests/types/public-review-gate-types.test.ts
```

Expected: FAIL with TypeScript or runtime fixture shape errors because `ProofBrokerReport` and `ReviewGateReport` do not yet expose the new recontract fields.

- [ ] **Step 3: Add the shared recontract guidance types**

In `src/types/proofBroker.ts`, add and export the new shared type, then attach it to `ProofBrokerReport`.

```ts
export interface ProofBrokerRecontractGuidance {
  required: boolean;
  reason: string;
  target: {
    effectiveWorktreePath: string;
    effectiveWorktreeBranch: string | null;
    effectiveWorktreeHead: string | null;
  };
  driftFiles: string[];
  recommendedIntent: string | null;
  recommendedContractPath: string;
  followUpCommands: string[];
}

export interface ProofBrokerReport {
  // ...
  recontract: ProofBrokerRecontractGuidance;
  prPassport: ProofBrokerPrPassport;
  passport: AgentChangePassport;
}
```

In `src/types/reviewGate.ts`, replace the old local shape with the shared one.

```ts
import type {
  ProofBrokerGapKind,
  ProofBrokerGapSeverity,
  ProofBrokerRecontractGuidance,
  ProofBrokerReport,
} from './proofBroker.js';

export type ReviewGateRecontractGuidance = ProofBrokerRecontractGuidance;
```

- [ ] **Step 4: Re-run the public-type tests**

Run:

```bash
npm test -- tests/types/public-proof-broker-types.test.ts tests/types/public-review-gate-types.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit the type expansion**

```bash
git add src/types/proofBroker.ts src/types/reviewGate.ts tests/types/public-proof-broker-types.test.ts tests/types/public-review-gate-types.test.ts
git commit -m "types: expand recontract guidance surface"
```

## Task 2: Teach Proof Broker To Build Rich Recontract Guidance

**Files:**
- Modify: `src/core/proofBroker.ts`
- Test: `tests/core/proofBroker.test.ts`

- [ ] **Step 1: Write the failing Proof Broker tests**

Add a missing-contract test that proves the richer object is emitted, an explicit-intent test, and an explicit-contract-path preservation test.

```ts
test('missing-contract proof broker emits target-aware recontract guidance', async () => {
  await fs.writeFile(path.join(tmp, 'package.json'), '{"name":"changed"}\n');

  const report = await computeProofBroker(tmp, {});

  expect(report.status).toBe('drifted');
  expect(report.recontract).toEqual(
    expect.objectContaining({
      required: true,
      target: expect.objectContaining({
        effectiveWorktreePath: canonicalPath(tmp),
      }),
      recommendedIntent: null,
      recommendedContractPath: '.projscan/proof-contract.json',
    }),
  );
  expect(report.recontract.followUpCommands[0]).toBe(
    'projscan prove --intent "<change intent>" --save-contract .projscan/proof-contract.json',
  );
});

test('proof broker reuses explicit intent in recontract guidance', async () => {
  await fs.writeFile(path.join(tmp, 'package.json'), '{"name":"changed"}\n');

  const report = await computeProofBroker(tmp, {
    intent: 'is my agent allowed to change billing retry logic?',
    saveContractPath: '.projscan/proof-contracts/billing-retry.json',
  });

  expect(report.recontract.recommendedIntent).toBe(
    'is my agent allowed to change billing retry logic?',
  );
  expect(report.recontract.recommendedContractPath).toBe(
    '.projscan/proof-contracts/billing-retry.json',
  );
  expect(report.recontract.followUpCommands[0]).toBe(
    'projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contracts/billing-retry.json',
  );
});
```

- [ ] **Step 2: Run the focused Proof Broker core tests and verify they fail**

Run:

```bash
npm test -- tests/core/proofBroker.test.ts
```

Expected: FAIL because `computeProofBroker()` does not yet return `recontract`.

- [ ] **Step 3: Implement the recontract builder in Proof Broker**

In `src/core/proofBroker.ts`, add a helper that derives the advisory recontract block from existing evidence.

```ts
function recontractGuidanceFor(
  passport: AgentChangePassport,
  receipt: ProveReceipt | undefined,
  requiredProof: ProofBrokerRequiredProof[],
  options: ComputeProofBrokerOptions,
): ProofBrokerRecontractGuidance {
  const recommendedContractPath = contractPathFor(passport.artifacts, options);
  const recommendedIntent = options.intent ?? passport.intent ?? null;
  const driftFiles = unique([
    ...passport.receipt.forbiddenTouched,
    ...passport.receipt.outsideAllowed,
  ]);
  const required =
    passport.receipt.scopeStatus === 'missing-contract' ||
    driftFiles.length > 0 ||
    passport.reviewer.action === 'stop-and-recontract';
  const proveCommand = `projscan prove --intent ${quoteShellArg(
    recommendedIntent ?? '<change intent>',
  )} --save-contract ${quoteShellArg(recommendedContractPath)}`;
  const followUpCommands = unique([
    proveCommand,
    ...passport.receipt.missingCommands,
    ...passport.receipt.failedCommands,
    ...passport.receipt.staleCommands,
    changedReceiptCommand({
      ...passport.artifacts,
      contractPath: recommendedContractPath,
    }),
    `projscan passport --contract ${quoteShellArg(recommendedContractPath)} --format markdown`,
    `projscan proof-broker --contract ${quoteShellArg(recommendedContractPath)} --pr-comment`,
  ]);

  return {
    required,
    reason: driftFiles.length > 0
      ? 'The current change left the approved boundary. Create a new contract instead of silently widening scope.'
      : required
        ? 'A Proof Contract is required before review.'
        : 'Current change is inside the approved boundary.',
    target: {
      effectiveWorktreePath: passport.target.effectiveWorktreePath,
      effectiveWorktreeBranch: passport.target.effectiveWorktreeBranch,
      effectiveWorktreeHead: passport.target.effectiveWorktreeHead,
    },
    driftFiles,
    recommendedIntent,
    recommendedContractPath,
    followUpCommands,
  };
}
```

Wire it into the report:

```ts
const recontract = recontractGuidanceFor(passport, receipt, requiredProof, options);

const reportWithoutPassport = {
  // ...
  recontract,
  nextCommands,
  warnings: passport.warnings,
  artifacts: passport.artifacts,
  passport,
};
```

- [ ] **Step 4: Render the richer recontract block in PR Passport Markdown**

Extend `renderPrPassportMarkdown()` with a compact recontract section.

```ts
lines.push('');
lines.push('### Recontract');
lines.push('');
lines.push(`- **Required:** ${report.recontract.required ? 'yes' : 'no'}`);
lines.push(`- **Reason:** ${escapeMarkdownText(report.recontract.reason)}`);
lines.push(`- **Worktree:** ${markdownInlineCode(report.recontract.target.effectiveWorktreePath)}`);
lines.push(`- **Contract path:** ${markdownInlineCode(report.recontract.recommendedContractPath)}`);
lines.push(`- **Intent:** ${escapeMarkdownText(report.recontract.recommendedIntent ?? '<change intent>')}`);
renderList(lines, 'Drift files', report.recontract.driftFiles);
renderList(lines, 'Follow-up commands', report.recontract.followUpCommands);
```

- [ ] **Step 5: Re-run the focused Proof Broker core tests**

Run:

```bash
npm test -- tests/core/proofBroker.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit the Proof Broker implementation**

```bash
git add src/core/proofBroker.ts tests/core/proofBroker.test.ts
git commit -m "feat: enrich proof broker recontract guidance"
```

## Task 3: Reuse The Shared Guidance In Review Gate And CLI Output

**Files:**
- Modify: `src/core/reviewGate.ts`
- Modify: `src/cli/commands/proofBroker.ts`
- Modify: `src/cli/commands/reviewGate.ts`
- Test: `tests/core/reviewGate.test.ts`
- Test: `tests/cli/proofBroker.test.ts`
- Test: `tests/cli/reviewGate.test.ts`

- [ ] **Step 1: Write the failing Review Gate and CLI tests**

Add assertions that Review Gate preserves Proof Broker guidance and that CLI output prints the richer section.

```ts
// tests/core/reviewGate.test.ts
expect(report.recontract.target.effectiveWorktreePath).toBe(canonicalPath(tmp));
expect(report.recontract.recommendedContractPath).toBe(contractPath);
expect(report.recontract.followUpCommands).toEqual(
  expect.arrayContaining([
    `projscan prove --intent "<change intent>" --save-contract ${contractPath}`,
    `projscan review-gate --contract ${contractPath} --pr-comment`,
  ]),
);

// tests/cli/proofBroker.test.ts
expect(report.recontract.recommendedContractPath).toBe('.projscan/proof-contract.json');
expect(report.recontract.followUpCommands[0]).toContain('projscan prove --intent');
expect(consoleResult.stdout).toContain('Recontract');
expect(consoleResult.stdout).toContain('Contract path');

// tests/cli/reviewGate.test.ts
expect(report.recontract.target.effectiveWorktreePath).toBe(canonicalPath(tmp));
expect(markdown.stdout).toContain('### Recontract');
expect(markdown.stdout).toContain('Contract path');
expect(markdown.stdout).toContain('Follow-up commands');
```

- [ ] **Step 2: Run the focused Review Gate and CLI tests and verify they fail**

Run:

```bash
npm test -- tests/core/reviewGate.test.ts tests/cli/proofBroker.test.ts tests/cli/reviewGate.test.ts
```

Expected: FAIL because Review Gate still builds `command`-only recontract guidance and the CLI does not print the richer fields.

- [ ] **Step 3: Make Review Gate reuse Proof Broker recontract guidance**

In `src/core/reviewGate.ts`, stop rebuilding the shape from scratch. Start from `proofBroker.recontract`, then append the final review-gate command if missing.

```ts
function recontractGuidanceFor(
  proofBroker: ProofBrokerReport,
  contractPath: string,
): ReviewGateRecontractGuidance {
  return {
    ...proofBroker.recontract,
    recommendedContractPath: contractPath,
    followUpCommands: unique([
      ...proofBroker.recontract.followUpCommands,
      `projscan review-gate --contract ${quoteShellArg(contractPath)} --pr-comment`,
    ]),
  };
}
```

Update the Markdown renderer to show the new fields.

```ts
lines.push(`- **Worktree:** ${markdownInlineCode(report.recontract.target.effectiveWorktreePath)}`);
lines.push(`- **Contract path:** ${markdownInlineCode(report.recontract.recommendedContractPath)}`);
lines.push(
  `- **Intent:** ${escapeMarkdownText(report.recontract.recommendedIntent ?? '<change intent>')}`,
);
lines.push(`- **Drift files:** ${markdownInlineList(report.recontract.driftFiles)}`);
lines.push('- **Follow-up commands:**');
for (const command of report.recontract.followUpCommands) {
  lines.push(`  - ${markdownInlineCode(command)}`);
}
```

- [ ] **Step 4: Print the richer recontract block in console mode**

Update `src/cli/commands/proofBroker.ts` and `src/cli/commands/reviewGate.ts` so the console output mirrors the new structure.

```ts
console.log('Recontract');
console.log(`- required: ${report.recontract.required ? 'yes' : 'no'}`);
console.log(`- reason: ${report.recontract.reason}`);
console.log(`- worktree: ${report.recontract.target.effectiveWorktreePath}`);
console.log(`- contract path: ${report.recontract.recommendedContractPath}`);
console.log(`- intent: ${report.recontract.recommendedIntent ?? '<change intent>'}`);
printList(report.recontract.driftFiles, 'No drift files');
printList(report.recontract.followUpCommands, 'No follow-up commands');
```

- [ ] **Step 5: Re-run the focused Review Gate and CLI tests**

Run:

```bash
npm test -- tests/core/reviewGate.test.ts tests/cli/proofBroker.test.ts tests/cli/reviewGate.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit the Review Gate and CLI changes**

```bash
git add src/core/reviewGate.ts src/cli/commands/proofBroker.ts src/cli/commands/reviewGate.ts tests/core/reviewGate.test.ts tests/cli/proofBroker.test.ts tests/cli/reviewGate.test.ts
git commit -m "feat: surface recontract recipes in review handoffs"
```

## Task 4: Update Docs And Run Dogfood Verification

**Files:**
- Modify: `docs/GUIDE.md`
- Verify: linked proof worktree output

- [ ] **Step 1: Write the failing docs expectation**

Add or tighten an existing docs assertion if one already covers Proof Broker / Review Gate guidance. If there is no existing targeted docs assertion for this wording, keep the docs validation inside the final focused verification run instead of creating a new broad test surface.

Use this exact wording in `docs/GUIDE.md` near the Proof Broker / Review Gate sections:

```md
When proof is missing or scope has drifted, Proof Broker and Review Gate emit a
concrete recontract recipe: target worktree, recommended contract path,
recommended intent when available, and ordered follow-up commands. The recipe is
advisory only; projscan does not create the new contract unless you explicitly
run `projscan prove --intent ... --save-contract ...`.
```

- [ ] **Step 2: Update the guide**

Edit `docs/GUIDE.md` in the Proof Broker / Review Gate command reference sections so the product contract is clear:

```md
- `recontract.recommendedContractPath` preserves an explicit contract path when one
  was supplied and otherwise defaults to `.projscan/proof-contract.json`.
- `recontract.followUpCommands` orders the restart loop so missing proof commands
  appear before replay and handoff commands.
```

- [ ] **Step 3: Run the focused build-and-test verification**

Run:

```bash
npm run build
npm test -- tests/types/public-proof-broker-types.test.ts tests/types/public-review-gate-types.test.ts tests/core/proofBroker.test.ts tests/core/reviewGate.test.ts tests/cli/proofBroker.test.ts tests/cli/reviewGate.test.ts
```

Expected: PASS

- [ ] **Step 4: Dogfood from the linked proof worktree**

Run:

```bash
npm exec projscan -- proof-broker --format json
npm exec projscan -- review-gate --format json
```

from:

```bash
/Users/abhyoh/local dev folder/Apps/projscan/.worktrees/agentloopkit-proof-phase-upgrade-train
```

Expected:

- both commands still block reviewer readiness because the proof worktree is genuinely drifted or missing proof
- both reports expose `recontract.target.effectiveWorktreePath` as the linked worktree
- both reports expose `recontract.recommendedContractPath`
- both reports expose ordered `recontract.followUpCommands`
- if no explicit intent was supplied, `recommendedIntent` is `null` or the rendered placeholder remains explicit

- [ ] **Step 5: Record the task-specific AgentLoop verification**

Run:

```bash
npm exec agentloop -- verify --task .agentloop/tasks/2026-07-06-agentloopkit-proof-phase-upgrade-train.md --task-commands --only-task-commands --write-run
```

Expected: PASS with a fresh verification report for this slice. If it fails, stop and record the failure honestly before any `ship` or `maintainer-check` run.

- [ ] **Step 6: Commit the docs and verification-ready finish**

```bash
git add docs/GUIDE.md
git commit -m "docs: explain recontract guidance recipe"
```

## Self-Review

- Spec coverage:
  - richer structured recontract guidance: Task 1 + Task 2
  - effective-worktree-aware target and contract path: Task 2 + Task 3
  - caller-supplied intent preservation: Task 2
  - Review Gate reuse instead of divergence: Task 3
  - JSON / console / Markdown updates: Task 2 + Task 3
  - docs and dogfood evidence: Task 4
- Placeholder scan:
  - no `TODO` / `TBD`
  - all commands and file paths are explicit
  - all new field names match the approved spec
- Type consistency:
  - shared type name: `ProofBrokerRecontractGuidance`
  - report field name: `recontract`
  - new properties: `target`, `recommendedIntent`, `recommendedContractPath`, `followUpCommands`

