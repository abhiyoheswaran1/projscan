# Reviewer Trust OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local `review-gate` workflow that turns Proof Broker evidence into one reviewer decision with proof debt, recontract guidance, CI behavior, PR Markdown, MCP parity, and public docs.

**Architecture:** Implement `review-gate` as an additive projection over `computeProofBroker()`. The new core module derives proof debt, review decision, recontract guidance, next commands, Markdown, and optional JSON artifact writes without running proof commands. CLI and MCP are thin adapters over the core report.

**Tech Stack:** TypeScript ESM, Commander CLI, Vitest, Node.js `fs/promises`, existing ProjScan markdown/atomic-write helpers, MCP tool catalog, AgentLoop verification.

---

## File Structure

- Create `src/types/reviewGate.ts`: public Review Gate option/report/debt/recontract/comment types.
- Create `src/core/reviewGate.ts`: core `computeReviewGate()`, projection helpers, Markdown renderer, safe artifact writer.
- Create `src/cli/commands/reviewGate.ts`: Commander command, console/CI renderers, exit-code policy.
- Create `src/mcp/tools/reviewGate.ts`: `projscan_review_gate` MCP adapter with no proof execution inputs.
- Create `tests/core/reviewGate.test.ts`: core TDD coverage for ready, needs-proof, drift, and artifact safety.
- Create `tests/cli/reviewGate.test.ts`: dist CLI smoke coverage for JSON, PR Markdown, CI exit behavior.
- Create `tests/mcp/reviewGate.test.ts`: MCP schema and handler coverage.
- Create `tests/types/public-review-gate-types.test.ts`: public barrel type coverage.
- Modify `src/cli/registerCommands.ts`: import/register `registerReviewGate` after `registerProofBroker` and before `registerGuard`.
- Modify `src/mcp/toolCatalog.ts`: include `reviewGateTool` after `proofBrokerTool`.
- Modify `src/publicCore.ts` and `src/types.ts`: export Review Gate core and types.
- Modify `src/utils/formatSupport.ts`: support `review-gate` console/json/markdown.
- Modify `.github/mcp-registry/server.json`, `tests/docs/publicCounts.test.ts`, and docs references from 50 to 51 MCP tools.
- Modify `README.md`, `docs/GUIDE.md`, `docs/STABILITY.md`, `docs/WEBSITE-UPDATE-PROMPT.md`, `CHANGELOG.md`, `DECISIONS.md`, `tests/docs/proveDocs.test.ts`.

## Constraints

- Do not release, tag, publish, push, or trigger release automation.
- Do not add dependencies.
- Do not execute proof commands from `review-gate` or MCP.
- Do not overwrite unrelated local artifacts.
- Preserve the already verified Proof Broker pre-release work.
- Because the current tree contains verified uncommitted Proof Broker work that Review Gate depends on, do not create implementation commits unless the user explicitly asks.

## Task 1: Core Type Contract and Failing Public Type Test

**Files:**
- Create: `src/types/reviewGate.ts`
- Test: `tests/types/public-review-gate-types.test.ts`
- Modify later: `src/types.ts`, `src/publicCore.ts`

- [ ] **Step 1: Write the public type test**

Create `tests/types/public-review-gate-types.test.ts`:

```ts
import { expect, test } from 'vitest';
import { computeReviewGate } from '../../src/publicCore.js';
import type {
  ComputeReviewGateOptions,
  ReviewGateProofDebtItem,
  ReviewGateReport,
} from '../../src/types.js';

const options: ComputeReviewGateOptions = {
  intent: 'change billing retry logic',
  saveContractPath: '.projscan/proof-contract.json',
  outputPassportPath: '.projscan/passport.json',
  outputPath: '.projscan/review-gate.json',
};

const debtItem: ReviewGateProofDebtItem = {
  id: 'missing-proof:npm run test:billing',
  kind: 'missing-proof',
  severity: 'warning',
  message: 'recipe:billing-retry-safety needs proof command npm run test:billing.',
  command: 'npm run test:billing',
  requirementId: 'recipe:billing-retry-safety',
  nextAction: 'Run npm run test:billing, then rerun projscan review-gate.',
};

const report: ReviewGateReport = {
  schemaVersion: 1,
  kind: 'review-gate',
  generatedAt: '2026-06-29T00:00:00.000Z',
  status: 'needs-proof',
  decision: {
    allowReview: false,
    outcome: 'needs-proof',
    summary: 'Review is not ready: 1 proof debt item remains.',
  },
  reviewer: {
    decision: 'needs-focused-review',
    action: 'run-proof',
    summary: 'Run the missing proof commands before review.',
  },
  proofDebt: {
    total: 1,
    blockers: 0,
    warnings: 1,
    byKind: {
      'missing-contract': 0,
      'scope-drift': 0,
      'missing-proof': 1,
      'failed-proof': 0,
      'stale-proof': 0,
      'weak-proof': 0,
      'recipe-gap': 0,
    },
    items: [debtItem],
  },
  recontract: {
    required: false,
    reason: 'Current change is inside the approved boundary.',
    driftFiles: [],
    command: 'projscan prove --intent "<change intent>" --save-contract .projscan/proof-contract.json',
  },
  requiredReviewers: ['@billing-platform'],
  nextCommands: ['npm run test:billing'],
  artifacts: {
    contractPath: '.projscan/proof-contract.json',
    passportPath: '.projscan/passport.json',
    reviewGatePath: '.projscan/review-gate.json',
  },
  prComment: {
    title: 'Projscan Review Gate',
    markdown: '## Projscan Review Gate',
  },
  proofBroker: {
    schemaVersion: 1,
    kind: 'proof-broker',
    generatedAt: '2026-06-29T00:00:00.000Z',
    status: 'needs-proof',
    summary: 'needs-proof: 1 proof gap remains before review.',
    reviewer: {
      decision: 'needs-focused-review',
      action: 'run-proof',
      summary: 'Run the missing proof commands before review.',
    },
    requiredProof: [],
    proof: {
      status: 'missing',
      missingCommands: ['npm run test:billing'],
      failedCommands: [],
      staleCommands: [],
    },
    scope: {
      status: 'within-contract',
      changedFiles: ['src/billing/retryPolicy.ts'],
      riskyChangedFiles: ['src/billing/retryPolicy.ts'],
      forbiddenTouched: [],
      outsideAllowed: [],
      changedAfterProof: [],
    },
    requiredReviewers: ['@billing-platform'],
    gaps: [],
    nextCommands: ['npm run test:billing'],
    warnings: [],
    artifacts: {
      contractPath: '.projscan/proof-contract.json',
      passportPath: '.projscan/passport.json',
    },
    prPassport: {
      title: 'Projscan PR Passport',
      sections: ['reviewer', 'scope', 'required-proof', 'gaps', 'reviewers', 'next-commands', 'artifacts'],
      markdown: '## Projscan PR Passport',
    },
    passport: {
      schemaVersion: 1,
      kind: 'agent-change-passport',
      generatedAt: '2026-06-29T00:00:00.000Z',
      status: 'needs-proof',
      summary: 'needs-proof: Run the missing proof commands before review.',
      boundary: {
        allowedFiles: ['src/billing/retryPolicy.ts'],
        forbiddenFiles: [],
        likelyTests: ['tests/billing/retryPolicy.test.ts'],
        riskyContracts: [],
        proofCommands: ['npm run test:billing'],
      },
      receipt: {
        scopeStatus: 'within-contract',
        proofStatus: 'missing',
        proofReplayStatus: 'needs-proof',
        changedFiles: ['src/billing/retryPolicy.ts'],
        forbiddenTouched: [],
        outsideAllowed: [],
        changedAfterProof: [],
        missingCommands: ['npm run test:billing'],
        failedCommands: [],
        staleCommands: [],
        requiredReviewers: ['@billing-platform'],
      },
      reviewer: {
        decision: 'needs-focused-review',
        action: 'run-proof',
        summary: 'Run the missing proof commands before review.',
      },
      nextCommands: ['npm run test:billing'],
      warnings: [],
      artifacts: {
        contractPath: '.projscan/proof-contract.json',
        passportPath: '.projscan/passport.json',
      },
      prove: {
        verdict: 'needs-review',
        verifiedWorkflow: {
          phase: 'receipt',
          status: 'needs-review',
          nextAction: 'record proof before review',
          nextCommand: 'projscan prove --record-command "<command>" --exit-code 0 --duration-ms <ms>',
          staleProof: false,
          missingProof: true,
          failedProof: false,
        },
      },
    },
  },
};

test('review gate public API types compile from the barrels', () => {
  expect(typeof computeReviewGate).toBe('function');
  expect(options.outputPath).toBe('.projscan/review-gate.json');
  expect(report.proofDebt.items[0].kind).toBe('missing-proof');
});
```

- [ ] **Step 2: Run the public type test and confirm it fails**

Run:

```bash
npm run test -- tests/types/public-review-gate-types.test.ts
```

Expected: FAIL because `computeReviewGate` and Review Gate types are not exported.

- [ ] **Step 3: Add initial type definitions**

Create `src/types/reviewGate.ts` with the public interfaces from Task 1. Import `ProofBrokerReport`, `ProofBrokerGapKind`, `ProofBrokerGapSeverity`, `AgentChangePassportReviewerAction`, and `AgentChangePassport`.

- [ ] **Step 4: Export review-gate barrels**

Modify `src/types.ts`:

```ts
export type * from './types/reviewGate.js';
```

Modify `src/publicCore.ts` after the Proof Broker export:

```ts
export { computeReviewGate } from './core/reviewGate.js';
```

- [ ] **Step 5: Add the minimal core export stub**

Create `src/core/reviewGate.ts`:

```ts
import type { ComputeReviewGateOptions, ReviewGateReport } from '../types/reviewGate.js';

export async function computeReviewGate(
  _rootPath: string,
  _options: ComputeReviewGateOptions = {},
): Promise<ReviewGateReport> {
  throw new Error('review-gate is not implemented yet');
}
```

- [ ] **Step 6: Run the public type test and typecheck**

Run:

```bash
npm run test -- tests/types/public-review-gate-types.test.ts
npm run typecheck
```

Expected: PASS for the type test; typecheck passes after imported types align.

## Task 2: Core Review Gate Projection

**Files:**
- Modify: `src/core/reviewGate.ts`
- Modify: `src/types/reviewGate.ts`
- Test: `tests/core/reviewGate.test.ts`

- [ ] **Step 1: Write focused core tests**

Create `tests/core/reviewGate.test.ts` with fixture setup matching `tests/core/proofBroker.test.ts`. Include four tests:

```ts
test('needs-proof gate itemizes proof debt and next commands', async () => {
  const report = await computeReviewGate(tmp, {
    intent: 'is my agent allowed to change billing retry logic?',
    saveContractPath: '.projscan/proof-contract.json',
    outputPassportPath: '.projscan/passport.json',
  });

  expect(report.kind).toBe('review-gate');
  expect(report.status).toBe('needs-proof');
  expect(report.decision.allowReview).toBe(false);
  expect(report.proofDebt.total).toBeGreaterThan(0);
  expect(report.proofDebt.items.map((item) => item.kind)).toContain('missing-proof');
  expect(report.recontract.required).toBe(false);
  expect(report.nextCommands).toContain('npm run test:billing');
  expect(report.prComment.markdown).toContain('## Projscan Review Gate');
});

test('drifted gate requires recontract when files leave the approved boundary', async () => {
  const contract = await computeReviewGate(tmp, {
    intent: 'is my agent allowed to change billing retry logic?',
    saveContractPath: '.projscan/proof-contract.json',
  });
  expect(contract.artifacts.contractPath).toBe('.projscan/proof-contract.json');

  await fs.writeFile(path.join(tmp, 'package.json'), '{"name":"changed"}\n');

  const report = await computeReviewGate(tmp, {
    contractPath: '.projscan/proof-contract.json',
  });

  expect(report.status).toBe('drifted');
  expect(report.decision.allowReview).toBe(false);
  expect(report.recontract.required).toBe(true);
  expect(report.recontract.driftFiles).toContain('package.json');
});

test('writes only review gate artifacts under allowed projscan paths', async () => {
  const report = await computeReviewGate(tmp, {
    intent: 'is my agent allowed to change billing retry logic?',
    saveContractPath: '.projscan/proof-contract.json',
    outputPath: '.projscan/review-gate.json',
  });

  const saved = JSON.parse(await fs.readFile(path.join(tmp, '.projscan/review-gate.json'), 'utf-8'));
  expect(saved.kind).toBe('review-gate');
  expect(report.artifacts.reviewGatePath).toBe('.projscan/review-gate.json');

  await fs.writeFile(path.join(tmp, '.projscan/review-gate.json'), '{"kind":"other"}\n');
  await expect(computeReviewGate(tmp, { outputPath: '.projscan/review-gate.json' })).rejects.toThrow(/Refusing to overwrite/);
  await expect(computeReviewGate(tmp, { outputPath: '../review-gate.json' })).rejects.toThrow(/must stay inside/);
});
```

- [ ] **Step 2: Run the core test and confirm failure**

Run:

```bash
npm run test -- tests/core/reviewGate.test.ts
```

Expected: FAIL because the core implementation still throws.

- [ ] **Step 3: Implement projection helpers**

In `src/core/reviewGate.ts`, import `computeProofBroker`, markdown helpers, shell quoting, safe artifact helpers, and `atomicWriteFile`. Implement:

- `computeReviewGate(rootPath, options)`
- `buildReviewGateReport(proofBroker, options)`
- `proofDebtFrom(proofBroker)`
- `recontractGuidanceFor(proofBroker, proofDebt)`
- `deriveStatus(proofBroker, proofDebt)`
- `renderReviewGateMarkdown(reportWithoutComment)`
- `writeReviewGateArtifact(root, outputPath, report)`

The report should set `decision.allowReview` only when status is `ready`.

- [ ] **Step 4: Run the core tests**

Run:

```bash
npm run test -- tests/core/reviewGate.test.ts
```

Expected: PASS.

## Task 3: CLI Review Gate Command and Exit Policy

**Files:**
- Create: `src/cli/commands/reviewGate.ts`
- Modify: `src/cli/registerCommands.ts`
- Modify: `src/utils/formatSupport.ts`
- Test: `tests/cli/reviewGate.test.ts`
- Test: `tests/cli/registerCommands.test.ts`

- [ ] **Step 1: Write CLI tests**

Create `tests/cli/reviewGate.test.ts` using dist CLI helpers from `tests/cli/proofBroker.test.ts`. Cover:

- `review-gate --format json` returns `kind: "review-gate"`.
- `review-gate --pr-comment` prints `## Projscan Review Gate`.
- `review-gate --ci --fail-on-needs-proof` exits non-zero for missing proof.
- `review-gate --ci --fail-on-block` exits zero for needs-proof but non-zero for drifted or blocked.

- [ ] **Step 2: Update registrar order test**

In `tests/cli/registerCommands.test.ts`, add `registerReviewGate` after `registerProofBroker`.

- [ ] **Step 3: Run CLI tests and confirm failure**

Run:

```bash
npm run test -- tests/cli/reviewGate.test.ts tests/cli/registerCommands.test.ts
```

Expected: FAIL because command registration does not exist.

- [ ] **Step 4: Implement command adapter**

Create `src/cli/commands/reviewGate.ts` with Commander options from the spec. Use `computeReviewGate()`. Render:

- JSON for `--format json`.
- Markdown for `--format markdown` or `--pr-comment`.
- compact CI summary for `--ci`.
- console summary by default.

Apply exit policy after rendering:

```ts
function shouldFail(report: ReviewGateReport, options: { failOnBlock?: boolean; failOnNeedsProof?: boolean }): boolean {
  if (options.failOnNeedsProof) return report.status !== 'ready';
  if (options.failOnBlock) return report.status === 'blocked' || report.status === 'drifted';
  return false;
}
```

- [ ] **Step 5: Wire command and formats**

Modify `src/cli/registerCommands.ts` to import/register `registerReviewGate`.

Modify `src/utils/formatSupport.ts`:

```ts
'review-gate': ['console', 'json', 'markdown'],
```

- [ ] **Step 6: Build and run CLI tests**

Run:

```bash
npm run build
npm run test -- tests/cli/reviewGate.test.ts tests/cli/registerCommands.test.ts
```

Expected: PASS.

## Task 4: MCP Tool and Public Count

**Files:**
- Create: `src/mcp/tools/reviewGate.ts`
- Modify: `src/mcp/toolCatalog.ts`
- Modify: `.github/mcp-registry/server.json`
- Modify: `tests/docs/publicCounts.test.ts`
- Test: `tests/mcp/reviewGate.test.ts`

- [ ] **Step 1: Write MCP tests**

Create `tests/mcp/reviewGate.test.ts`:

```ts
test('lists projscan_review_gate MCP tool without proof execution inputs', () => {
  const tool = getToolDefinitions().find((entry) => entry.name === 'projscan_review_gate');

  expect(tool).toBeDefined();
  expect(tool?.description).toContain('Review Gate');
  expect(tool?.inputSchema.properties?.intent.description).toContain('change intent');
  expect(tool?.inputSchema.properties?.contract_path.description).toContain('Proof Contract');
  expect(tool?.inputSchema.properties?.run).toBeUndefined();
  expect(tool?.inputSchema.properties?.run_command).toBeUndefined();
});
```

Add a handler test that changes `src/billing/retryPolicy.ts`, invokes the handler with `intent`, `save_contract_path`, and `output_passport_path`, and asserts `proofBroker.kind`, `proofDebt.total`, and `prComment.markdown`.

- [ ] **Step 2: Run MCP tests and confirm failure**

Run:

```bash
npm run test -- tests/mcp/reviewGate.test.ts tests/docs/publicCounts.test.ts
```

Expected: FAIL because the MCP tool and 51-tool metadata do not exist.

- [ ] **Step 3: Implement MCP adapter**

Create `src/mcp/tools/reviewGate.ts` by following `src/mcp/tools/proofBroker.ts`, with inputs:

- `intent`
- `contract_path`
- `save_contract_path`
- `output_passport_path`
- `output_path`
- `max_files`
- `feedback_path`
- `base_ref`
- `ledger_path`
- `max_tokens`

Do not expose `run`, `run_command`, or proof execution fields.

- [ ] **Step 4: Register MCP tool and count metadata**

Modify `src/mcp/toolCatalog.ts` to import and include `reviewGateTool` after `proofBrokerTool`.

Modify `.github/mcp-registry/server.json` description and package version metadata only if it already reflects 4.18.0 pre-release metadata; change tool count from 50 to 51.

Modify `tests/docs/publicCounts.test.ts` expected registry text from 50 to 51 tools.

- [ ] **Step 5: Build and run MCP/count tests**

Run:

```bash
npm run build
npm run test -- tests/mcp/reviewGate.test.ts tests/docs/publicCounts.test.ts
```

Expected: PASS.

## Task 5: Docs, Stability, Changelog, and Decisions

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/STABILITY.md`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`
- Modify: `CHANGELOG.md`
- Modify: `DECISIONS.md`
- Modify: `tests/docs/proveDocs.test.ts`

- [ ] **Step 1: Update docs assertions first**

Extend `tests/docs/proveDocs.test.ts` to require:

- `projscan review-gate`
- `projscan_review_gate`
- `51 MCP tools`
- `Reviewer Trust OS`
- `proof debt`
- `recontract`
- `--fail-on-needs-proof`

- [ ] **Step 2: Run docs tests and confirm failure**

Run:

```bash
npm run test -- tests/docs/proveDocs.test.ts tests/docs/publicCounts.test.ts
```

Expected: FAIL because docs do not mention Review Gate yet.

- [ ] **Step 3: Update public docs**

Update:

- README verified workflow: add `projscan review-gate --contract .projscan/proof-contract.json --pr-comment`.
- README 4.18.0 notes: rename the story to Reviewer Trust OS with Proof Broker as the underlying layer.
- GUIDE command map and command reference: add `### review-gate`.
- STABILITY: add command name, flags, JSON stability paragraph, MCP tool name.
- WEBSITE prompt: update headline, primary story, commands, 51 tool count, acceptance checks.
- CHANGELOG: add Review Gate bullets under the current 4.18.0 entry.
- DECISIONS: add a decision for Review Gate as an additive projection over Proof Broker.

- [ ] **Step 4: Run docs tests**

Run:

```bash
npm run test -- tests/docs/proveDocs.test.ts tests/docs/publicCounts.test.ts
```

Expected: PASS.

## Task 6: Stop-Slop and Focused Verification

**Files:**
- Review public docs changed in Task 5.

- [ ] **Step 1: Run stop-slop phrase scans on changed public docs**

Run:

```bash
git diff --unified=0 -- README.md docs/GUIDE.md docs/WEBSITE-UPDATE-PROMPT.md docs/STABILITY.md CHANGELOG.md DECISIONS.md | rg '^\\+[^+]' | rg -i "(h[e]re.?s|this m[a]tters|make n[o] mistake|at its c[o]re|in t[o]day|it.?s worth n[o]ting|at the end of the d[a]y|when it c[o]mes to|in a w[o]rld where|the r[e]ality is|a[c]tually|r[e]ally|s[i]mply|g[e]nuinely|h[o]nestly|cl[e]arly|qu[i]ckly|d[e]eply|tr[u]ly|f[u]ndamentally|cr[u]cially|imp[o]rtantly|—|s[e]amless|r[o]bust|p[o]werful|d[e]light|game.?ch[a]nger|unl[o]ck|superch[a]rge)"
```

Expected: no matches except technical terms that are intentionally quoted.

- [ ] **Step 2: Run focused implementation verification**

Run:

```bash
npm run test -- tests/core/reviewGate.test.ts tests/cli/reviewGate.test.ts tests/mcp/reviewGate.test.ts tests/types/public-review-gate-types.test.ts tests/docs/proveDocs.test.ts tests/docs/publicCounts.test.ts
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all commands PASS.

## Task 7: Release-Grade Verification and Handoff

**Files:**
- Modify AgentLoop reports and handoffs through commands only.

- [ ] **Step 1: Run AgentLoop task verification**

Run:

```bash
npm exec agentloop -- verify --task .agentloop/tasks/2026-06-29-reviewer-trust-os-five-loop.md --task-commands --only-task-commands --write-run --progress --timeout-ms 3600000
```

Expected: overall status `pass`.

- [ ] **Step 2: Generate handoff and gate evidence**

Run:

```bash
npm exec agentloop -- handoff --task .agentloop/tasks/2026-06-29-reviewer-trust-os-five-loop.md --write-run
npm exec agentloop -- check-gates
npm exec agentloop -- ship
```

Expected: gates pass; ship has no blockers.

- [ ] **Step 3: Mark task done without release**

Run:

```bash
npm exec agentloop -- task status .agentloop/tasks/2026-06-29-reviewer-trust-os-five-loop.md done
npm exec agentloop -- handoff --task .agentloop/tasks/2026-06-29-reviewer-trust-os-five-loop.md --write-run
```

Expected: task marked `done`; handoff covers current dirty files.

- [ ] **Step 4: Stop before release**

Do not run:

```bash
npm publish
git tag
git push
gh release create
npm exec agentloop -- release
```

Expected: final response says no release was performed and lists verification evidence.
