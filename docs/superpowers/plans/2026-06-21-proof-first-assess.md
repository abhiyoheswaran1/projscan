# Proof-First Assess Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `projscan assess` as a proof-first engineering assessment workflow with Proof Cards, fix-first mode, risk delta, MCP exposure, docs, and verification.

**Architecture:** Compose existing `quality-scorecard`, `bug-hunt`, and `preflight` signals into a new read-only assessment layer. Keep Proof Card creation and risk delta calculation in focused core modules so CLI and MCP share one schema. Avoid new dependencies and avoid side effects from `assess`.

**Tech Stack:** TypeScript, Commander CLI, Vitest, existing projscan core analyzers, existing MCP tool wrapper pattern, Markdown/JSON output.

---

## File Structure

- Create `src/types/assess.ts`: public assessment, proof-card, and risk-delta types.
- Create `src/core/proofCards.ts`: convert quality and bug-hunt risks into evidence-backed Proof Cards.
- Create `src/core/riskDelta.ts`: deterministic baseline and projected risk scoring.
- Create `src/core/assess.ts`: orchestrate scorecard, bug-hunt, preflight, proof cards, answers, and commands.
- Create `src/cli/commands/assess.ts`: CLI registration and markdown/JSON rendering.
- Modify `src/cli/registerCommands.ts`: register `assess`.
- Modify `src/utils/formatSupport.ts`: add formats for `assess`.
- Create `src/mcp/tools/assess.ts`: MCP wrapper.
- Modify `src/mcp/toolCatalog.ts`: register MCP tool.
- Modify `src/types.ts` and `src/publicCore.ts`: export public types and core helper.
- Add tests under `tests/core`, `tests/cli`, `tests/mcp`, and `tests/types`.
- Update `README.md`, `docs/GUIDE.md`, and `DECISIONS.md`.

## Phase 1: Core Assess Report And Proof Cards

### Task 1: Public Types

**Files:**
- Create: `src/types/assess.ts`
- Modify: `src/types.ts`
- Test: `tests/types/public-assess-types.test.ts`

- [ ] **Step 1: Write the public type test**

```ts
import type {
  AssessMode,
  AssessProofCard,
  AssessReport,
  RiskDeltaSnapshot,
} from '../../src/types/assess.js';
import type { AssessReport as BarrelAssessReport } from '../../src/types.js';

const mode: AssessMode = 'fix-first';
const delta: RiskDeltaSnapshot = {
  baselineScore: 62,
  projectedScore: 78,
  delta: 16,
  basis: ['health score 100', '1 p1 proof card'],
};
const card: AssessProofCard = {
  id: 'proof-hotspot-src-core-bughunt-ts',
  priority: 'p1',
  finding: 'src/core/bugHunt.ts is a maintainability hotspot',
  whyItMatters: 'High-risk files slow reviews and concentrate regressions.',
  files: ['src/core/bugHunt.ts'],
  evidence: [{ source: 'quality-scorecard', detail: 'risk 206' }],
  impact: {
    commands: ['projscan file src/core/bugHunt.ts --format json'],
    affectedAreas: ['maintainability'],
    likelyFiles: ['src/core/bugHunt.ts'],
  },
  recommendedFix: {
    summary: 'Split ranking, evidence, and output shaping into focused helpers.',
    safeChangeShape: 'Extract one pure helper at a time and keep existing tests green.',
  },
  verification: {
    commands: ['projscan quality-scorecard --format json', 'npm test'],
    expected: 'The hotspot remains explainable and tests pass.',
  },
  confidence: 'high',
  suppression: {
    command: 'projscan feedback intake --text "proof-hotspot-src-core-bughunt-ts: false positive because ..." --format json',
  },
  feedback: {
    command: 'projscan feedback intake --text "proof-hotspot-src-core-bughunt-ts: ..." --format json',
  },
  riskDelta: delta,
};
const report: AssessReport = {
  schemaVersion: 1,
  goal: 'make this repo safer to ship this week',
  mode,
  verdict: 'watch',
  summary: 'watch: 1 proof-backed action should reduce maintainability risk',
  answers: {
    actuallyRisky: 'Maintainability hotspots are the top current risk.',
    whyRisky: 'The first hotspot combines churn, complexity, or issue evidence.',
    fixFirst: 'Start with src/core/bugHunt.ts.',
    safestChange: 'Make one bounded extraction and keep tests green.',
    testsThatProveIt: ['npm test'],
    riskRemoved: 'Projected risk score improves by 16.',
    shipNow: 'Ship only after the proof commands pass.',
  },
  proofCards: [card],
  fixFirst: card,
  riskDelta: delta,
  commands: ['projscan assess --mode fix-first --format json'],
  feedback: [card.feedback.command],
};
const barrel: BarrelAssessReport = report;

test('assess public types compile from focused module and barrel', () => {
  expect(barrel.proofCards[0]?.confidence).toBe('high');
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- tests/types/public-assess-types.test.ts`

Expected: FAIL because `src/types/assess.ts` does not exist.

- [ ] **Step 3: Add the types and barrel export**

Define `AssessMode`, `AssessVerdict`, `AssessConfidence`, `AssessEvidence`, `AssessProofCard`, `RiskDeltaSnapshot`, `AssessAnswers`, and `AssessReport`. Export them from `src/types.ts`.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `npm test -- tests/types/public-assess-types.test.ts`

Expected: PASS.

### Task 2: Risk Delta Scoring

**Files:**
- Create: `src/core/riskDelta.ts`
- Test: `tests/core/riskDelta.test.ts`

- [ ] **Step 1: Write tests for deterministic scoring**

```ts
import { computeRiskDelta } from '../../src/core/riskDelta.js';

test('risk delta improves when a p1 proof card is selected', () => {
  const delta = computeRiskDelta({
    healthScore: 100,
    qualityVerdict: 'needs_attention',
    preflightVerdict: 'caution',
    proofCards: [
      { id: 'a', priority: 'p1', source: 'hotspot' },
      { id: 'b', priority: 'p2', source: 'issue' },
    ],
    selectedCardIds: ['a'],
  });
  expect(delta.projectedScore).toBeGreaterThan(delta.baselineScore);
  expect(delta.delta).toBe(delta.projectedScore - delta.baselineScore);
  expect(delta.basis.join(' ')).toContain('p1');
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- tests/core/riskDelta.test.ts`

Expected: FAIL because `computeRiskDelta` does not exist.

- [ ] **Step 3: Implement `computeRiskDelta`**

Use a simple clamped 0 to 100 model:

- start with `healthScore`
- subtract verdict penalty
- subtract preflight penalty
- subtract visible-card penalty by priority
- add back selected-card expected improvement

- [ ] **Step 4: Run the focused test**

Run: `npm test -- tests/core/riskDelta.test.ts`

Expected: PASS.

### Task 3: Proof Card Builder

**Files:**
- Create: `src/core/proofCards.ts`
- Test: `tests/core/proofCards.test.ts`

- [ ] **Step 1: Write tests for issue and hotspot cards**

```ts
import { buildProofCards } from '../../src/core/proofCards.js';

test('buildProofCards turns quality risks into evidence-backed cards', () => {
  const cards = buildProofCards({
    goal: 'make this repo safer',
    qualityRisks: [
      {
        id: 'qs-hotspot-src-core-bughunt-ts',
        priority: 'p1',
        title: 'Hotspot src/core/bugHunt.ts',
        files: ['src/core/bugHunt.ts'],
        source: 'hotspot',
        command: 'projscan file src/core/bugHunt.ts --format json',
      },
    ],
    bugHuntFindings: [],
    maxCards: 3,
  });

  expect(cards[0]).toMatchObject({
    priority: 'p1',
    finding: 'Hotspot src/core/bugHunt.ts',
    confidence: 'high',
  });
  expect(cards[0]?.evidence[0]?.source).toBe('quality-scorecard');
  expect(cards[0]?.verification.commands).toContain('projscan quality-scorecard --format json');
  expect(cards[0]?.feedback.command).toContain('projscan feedback intake');
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- tests/core/proofCards.test.ts`

Expected: FAIL because `buildProofCards` does not exist.

- [ ] **Step 3: Implement `buildProofCards`**

Rules:

- de-duplicate by risk id and first file
- prefer bug-hunt concrete fixes over hotspot-only cards when priorities tie
- include shell-safe command strings already provided by upstream reports
- set confidence high for issue-backed cards, medium for hotspot-only cards with one evidence source, low only when evidence is incomplete
- include feedback command for every card

- [ ] **Step 4: Run the focused test**

Run: `npm test -- tests/core/proofCards.test.ts`

Expected: PASS.

### Task 4: Assess Orchestrator

**Files:**
- Create: `src/core/assess.ts`
- Modify: `src/publicCore.ts`
- Test: `tests/core/assess.test.ts`

- [ ] **Step 1: Write orchestrator tests with mocked dependencies**

Mock `computeQualityScorecard`, `computeBugHunt`, and `computePreflight`. Assert that:

- standard mode answers all seven questions
- fix-first mode returns at most two cards
- blocked preflight produces `verdict: "blocked"`
- commands include proof and continuation commands

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- tests/core/assess.test.ts`

Expected: FAIL because `computeAssess` does not exist.

- [ ] **Step 3: Implement `computeAssess`**

Signature:

```ts
export interface ComputeAssessOptions {
  goal?: string;
  mode?: AssessMode;
  maxCards?: number;
}

export async function computeAssess(
  rootPath: string,
  options: ComputeAssessOptions = {},
): Promise<AssessReport>;
```

- [ ] **Step 4: Run the focused test**

Run: `npm test -- tests/core/assess.test.ts`

Expected: PASS.

## Phase 1 Bug, Security, And Performance Pass

- [ ] Run `npm test -- tests/types/public-assess-types.test.ts tests/core/riskDelta.test.ts tests/core/proofCards.test.ts tests/core/assess.test.ts`
- [ ] Run `npm run typecheck`
- [ ] Run `npm exec projscan -- assess --goal "make this repo safer to ship this week" --format json` after CLI exists, or defer to Phase 2 if CLI is not implemented yet.
- [ ] Inspect command-string construction for shell injection risk. All file commands must come from upstream quoted command helpers or fixed literals.
- [ ] Inspect runtime for duplicated full scans. Phase 1 may call scorecard, bug-hunt, and preflight separately; record if this becomes too slow on projscan itself.

## Phase 2: CLI, Formats, MCP, And Docs

### Task 5: CLI Command And Format Support

**Files:**
- Create: `src/cli/commands/assess.ts`
- Modify: `src/cli/registerCommands.ts`
- Modify: `src/utils/formatSupport.ts`
- Test: `tests/cli/assess.test.ts`
- Test: `tests/cli/registerCommands.test.ts`

- [ ] **Step 1: Write CLI tests**

Assert that:

- `projscan assess --goal "make this repo safer" --format json --quiet` emits `schemaVersion: 1`
- `projscan assess --mode fix-first --format markdown --quiet` prints Proof Cards and commands
- unsupported formats fail through the shared format matrix
- register command list includes `registerAssess`

- [ ] **Step 2: Run CLI tests and confirm failure**

Run: `npm test -- tests/cli/assess.test.ts tests/cli/registerCommands.test.ts -t assess`

Expected: FAIL because command is not registered.

- [ ] **Step 3: Implement CLI command**

Options:

- `--goal <text>`
- `--mode <standard|fix-first|ship-readiness>`
- `--max-cards <count>`

Formats:

- `console`
- `json`
- `markdown`

- [ ] **Step 4: Run CLI tests**

Run: `npm test -- tests/cli/assess.test.ts tests/cli/registerCommands.test.ts -t assess`

Expected: PASS.

### Task 6: MCP Tool

**Files:**
- Create: `src/mcp/tools/assess.ts`
- Modify: `src/mcp/toolCatalog.ts`
- Test: `tests/mcp/assess.test.ts`

- [ ] **Step 1: Write MCP tests**

Assert that tool definitions include `projscan_assess`, input schema documents `goal`, `mode`, and `max_cards`, and handler returns `{ assess }`.

- [ ] **Step 2: Run MCP tests and confirm failure**

Run: `npm test -- tests/mcp/assess.test.ts`

Expected: FAIL because tool is not registered.

- [ ] **Step 3: Implement MCP tool**

Use the same pattern as `qualityScorecardTool` and `bugHuntTool`.

- [ ] **Step 4: Run MCP tests**

Run: `npm test -- tests/mcp/assess.test.ts`

Expected: PASS.

### Task 7: Docs And Decision Record

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `DECISIONS.md`
- Test: `tests/docs/assessDocs.test.ts`

- [ ] **Step 1: Write docs tests**

Assert README and guide mention:

- `projscan assess --goal`
- Proof Cards
- `projscan assess --mode fix-first`
- no release/publish workflow claim

- [ ] **Step 2: Run docs tests and confirm failure**

Run: `npm test -- tests/docs/assessDocs.test.ts`

Expected: FAIL until docs are updated.

- [ ] **Step 3: Update docs**

Keep copy direct:

```md
`projscan assess` is the proof-first assessment command. It turns existing health, hotspot, bug-hunt, and preflight evidence into Proof Cards with verification commands.
```

- [ ] **Step 4: Run docs tests**

Run: `npm test -- tests/docs/assessDocs.test.ts`

Expected: PASS.

## Phase 2 Bug, Security, And Performance Pass

- [ ] Run `npm test -- tests/cli/assess.test.ts tests/mcp/assess.test.ts tests/docs/assessDocs.test.ts`
- [ ] Run `npm exec projscan -- assess --mode fix-first --format markdown`
- [ ] Run `npm exec projscan -- privacy-check --offline --format json`
- [ ] Confirm `assess` has no write calls and does not touch `.projscan-memory`.
- [ ] Time `projscan assess --format json` on this repo and capture the runtime in the handoff.

## Phase 3: Risk Delta Refinement And Trust Memory Hooks

### Task 8: Before/After Snapshot Option

**Files:**
- Modify: `src/core/riskDelta.ts`
- Modify: `src/core/assess.ts`
- Modify: `src/cli/commands/assess.ts`
- Test: `tests/core/riskDeltaSnapshots.test.ts`
- Test: `tests/cli/assessSnapshots.test.ts`

- [ ] **Step 1: Add tests for snapshot comparison**

Support read-only `--baseline <path>` where the path points to a prior `AssessReport` JSON file. The command compares current risk against that baseline. Do not write snapshots in the first version.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- tests/core/riskDeltaSnapshots.test.ts tests/cli/assessSnapshots.test.ts`

Expected: FAIL until baseline comparison exists.

- [ ] **Step 3: Implement baseline comparison**

Use `fs.readFile` and JSON parse with validation. On invalid input, fail with a clear message and do not scan secrets.

- [ ] **Step 4: Run snapshot tests**

Run: `npm test -- tests/core/riskDeltaSnapshots.test.ts tests/cli/assessSnapshots.test.ts`

Expected: PASS.

### Task 9: Feedback And Suppression Hints

**Files:**
- Modify: `src/core/proofCards.ts`
- Test: `tests/core/proofCardsFeedback.test.ts`

- [ ] **Step 1: Add tests for suppression hints**

Issue-backed Proof Cards should include:

- inline ignore hint when the issue has a line location
- `suppress` config hint when the issue has a rule id and file
- feedback intake command for every card

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- tests/core/proofCardsFeedback.test.ts`

Expected: FAIL until hints are richer.

- [ ] **Step 3: Implement hint enrichment**

Do not write config automatically. Only provide copyable commands or snippets.

- [ ] **Step 4: Run feedback tests**

Run: `npm test -- tests/core/proofCardsFeedback.test.ts`

Expected: PASS.

## Phase 3 Bug, Security, And Performance Pass

- [ ] Run all assess-focused tests.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm exec projscan -- assess --goal "make this repo safer to ship this week" --format json`.
- [ ] Run `npm exec projscan -- assess --mode fix-first --format markdown`.
- [ ] Check that baseline file errors do not print file contents.
- [ ] Confirm `assess` remains read-only by checking `git status --short` before and after commands.

## Final Verification

- [ ] Run AgentLoop task verification:

```bash
npm exec agentloop -- verify --task .agentloop/tasks/2026-06-21-proof-first-assess-workflow.md --task-commands --only-task-commands --write-run
```

- [ ] Run gates:

```bash
npm exec agentloop -- check-gates
npm exec agentloop -- ship
```

- [ ] Generate handoff with files changed, tests run, risks, rollback, and release recommendation.
- [ ] Do not tag, publish, or release. Wait for explicit approval.

