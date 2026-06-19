# Product Usefulness Train Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen projscan around daily engineering usefulness: feedback intake, resolver trust, caution quality, PR workflow proof, and common-path speed.

**Architecture:** Implement one bounded slice at a time behind existing CLI/core patterns. Each slice gets failing tests first, minimal additive code, targeted verification, a bug pass, AgentLoop handoff, and a commit before moving to the next slice.

**Tech Stack:** TypeScript, Vitest, Commander CLI, AgentLoopKit, existing projscan core/reporting modules.

---

### Task 1: Feedback Intake

**Files:**

- Modify: `src/core/feedback.ts`
- Modify: `src/cli/commands/feedback.ts`
- Modify: `src/types/dogfood.ts`
- Test: `tests/core/feedback.test.ts`
- Test: `tests/cli/feedback.test.ts`

- [ ] **Step 1: Write failing core tests**

Add tests that call a new `classifyFeedbackIntake()` export with raw text for unused-export false positives, noisy caution output, missing framework rules, confusing docs/output, and useful signals.

- [ ] **Step 2: Verify red**

Run: `npm test -- tests/core/feedback.test.ts`
Expected: FAIL because `classifyFeedbackIntake` is not exported.

- [ ] **Step 3: Implement core classifier**

Add local, deterministic keyword classification. Output must include `category`, `confidence`, `summary`, `taskTitle`, `suggestedCommand`, and `nextCommand`.

- [ ] **Step 4: Add CLI intake**

Add `projscan feedback intake --text <text> --format json` and `--append --file <path>` using existing feedback artifact behavior.

- [ ] **Step 5: Verify and bug pass**

Run:

```bash
npm test -- tests/core/feedback.test.ts tests/cli/feedback.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- bug-hunt --format json
```

### Task 2: Resolver Conformance Suite

**Files:**

- Modify: `tests/core/importGraph.test.ts`
- Modify: `tests/analyzers/deadCodeCheck.test.ts`
- Modify only the resolver/import graph files needed by red tests.

- [ ] **Step 1: Write failing tests**

Cover `tsconfig.paths`, `baseUrl`, package `exports`, barrel re-exports, Vite/Vitest aliases, and workspace package import resolution.

- [ ] **Step 2: Implement minimal resolver fixes**

Use existing structured project-config helpers before adding any new parsing logic.

- [ ] **Step 3: Verify and bug pass**

Run:

```bash
npm test -- tests/core/importGraph.test.ts tests/analyzers/deadCodeCheck.test.ts
npm run typecheck
npm run lint
npm exec projscan -- bug-hunt --format json
```

### Task 3: Caution Budget

**Files:**

- Modify caution assembly/reporting modules only after locating the existing verdict/caution builders.
- Add tests beside existing preflight/evidence-pack/release-train tests.

- [ ] **Step 1: Write failing tests**

Assert one primary caution, review-only grouping for secondary cautions, and explicit `fix_now` versus `manual_signoff` action labels.

- [ ] **Step 2: Implement caution ranking**

Rank concrete fixable blockers above manual review notes. Preserve existing JSON fields where possible and add fields only when needed.

- [ ] **Step 3: Verify and bug pass**

Run:

```bash
npm test -- tests/core/preflight*.test.ts tests/core/releaseEvidence.test.ts
npm run typecheck
npm run lint
npm exec projscan -- bug-hunt --format json
```

### Task 4: Killer PR Workflow

**Files:**

- Modify evidence-pack/start/workplan surfaces only where the workflow has unclear handoff.
- Add CLI/core tests for the exact `start -> preflight -> bug-hunt -> evidence-pack -> feedback` loop.

- [ ] **Step 1: Write failing workflow tests**

Assert the PR evidence output names what changed, top risk, first fix, owner/reviewer route, proof run, and feedback capture command.

- [ ] **Step 2: Implement workflow polish**

Prefer existing report sections and commands over new concepts.

- [ ] **Step 3: Verify and bug pass**

Run:

```bash
npm test -- tests/core/releaseEvidence.test.ts tests/cli/evidencePack*.test.ts tests/core/start*.test.ts
npm run typecheck
npm run lint
npm exec projscan -- bug-hunt --format json
```

### Task 5: Performance Pass

**Files:**

- Inspect common-path graph/dataflow/start/preflight/evidence-pack code before editing.
- Add focused tests only for cache/skip behavior that changes.

- [ ] **Step 1: Measure baseline**

Run:

```bash
time node dist/cli/index.js start --format json >/tmp/projscan-start.json
time node dist/cli/index.js preflight --format json >/tmp/projscan-preflight.json
time node dist/cli/index.js bug-hunt --format json >/tmp/projscan-bug-hunt.json
time node dist/cli/index.js evidence-pack --format json >/tmp/projscan-evidence-pack.json
```

- [ ] **Step 2: Optimize one proven bottleneck**

Only cache or skip repeated work found in the baseline. Do not add a daemon or hidden background process.

- [ ] **Step 3: Verify and bug pass**

Run:

```bash
npm test -- tests/core tests/cli
npm run typecheck
npm run lint
npm run build
npm exec projscan -- bug-hunt --format json
```
