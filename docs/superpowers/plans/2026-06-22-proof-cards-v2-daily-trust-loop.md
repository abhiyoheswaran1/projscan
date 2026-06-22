# Proof Cards V2 Daily Trust Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the no-release Proof Cards V2 daily trust loop with richer evidence, daily safe-commit routing, trust memory, AgentLoopKit handoff packets, simulator alternatives, docs/demo updates, and performance evidence.

**Architecture:** Keep the workflow additive. Enrich existing `AssessProofCard` and `SimulateReport` structures, reuse current quality/bug-hunt/preflight/feedback data, and expose the same fields through CLI and MCP. Do not add a daemon, dependency, network path, or release automation.

**Tech Stack:** TypeScript, Commander CLI, MCP stdio tools, Vitest, AgentLoopKit, existing projscan core modules.

---

## File Map

- `src/types/assess.ts`: additive Proof Card V2 fields.
- `src/core/proofCards.ts`: evidence strength, ranking reasons, trust memory, and AgentLoopKit handoff packet creation.
- `src/core/assess.ts`: optional feedback artifact input and answers that cite richer evidence.
- `src/cli/commands/assess.ts`: CLI flags/rendering for Proof Card V2 fields.
- `src/mcp/tools/assess.ts`: additive MCP payload coverage.
- `src/core/startIntentRouter.ts`, `src/core/start*`: safe-commit routing and compact proof path.
- `src/core/feedback.ts`: reusable memory summary for ranking.
- `src/types/simulate.ts`: additive alternative comparison fields.
- `src/core/simulate.ts`: compare bounded extraction, test-first, and leave-unchanged alternatives.
- `src/cli/commands/simulate.ts`, `src/mcp/tools/simulate.ts`: render/expose alternatives.
- `README.md`, `docs/GUIDE.md`, `docs/FIRST-10-MINUTES.md`: product workflow docs.
- `scripts/capture-readme-assets.mjs`, `docs/demos/*`: demo/screenshot updates if output shape changes.
- `DECISIONS.md`: record public additive behavior.

## Task 1: Proof Cards V2 Evidence

**Files:**
- Modify: `src/types/assess.ts`
- Modify: `src/core/proofCards.ts`
- Modify: `src/core/assess.ts`
- Test: `tests/core/assess.test.ts`
- Test: `tests/core/proofCards.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests asserting each proof card includes `evidenceStrength`, `confidenceReason`, `evidenceGaps`, `ranking`, and `agentHandoff`, and that hotspot-only evidence remains medium confidence with a gap rather than pretending to be high confidence.

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- tests/core/assess.test.ts tests/core/proofCards.test.ts
```

Expected: fail because the additive fields do not exist yet.

- [ ] **Step 3: Implement minimal evidence enrichment**

Add the fields to `AssessProofCard`, calculate evidence strength from source diversity and command coverage, add confidence reasons/gaps, and build deterministic handoff packet fields from existing card data.

- [ ] **Step 4: Verify green and bug pass**

Run:

```bash
npm test -- tests/core/assess.test.ts tests/core/proofCards.test.ts
npm exec projscan -- bug-hunt --format json
```

Expected: tests pass; bug-hunt has no concrete blocker introduced by the phase.

## Task 2: Daily Safe Commit Routing

**Files:**
- Modify: `src/core/intentRouter.ts` or current start-routing helper
- Modify: `src/core/startReportBuilder.ts`
- Test: `tests/core/start.test.ts`
- Test: `tests/cli/startIntentRouting.test.ts`

- [ ] **Step 1: Write failing tests**

Assert that `projscan start --intent "is this safe to commit?"` resolves to before-commit proof, exposes one primary next action, and includes `projscan assess --mode fix-first --format json` plus before-commit preflight in proof commands.

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- tests/core/start.test.ts tests/cli/startIntentRouting.test.ts
```

Expected: fail until the safe-commit intent routes to the compact daily path.

- [ ] **Step 3: Implement minimal route and compact output**

Extend the existing deterministic router keyword weights and Mission Control assembly. Keep existing fields intact.

- [ ] **Step 4: Verify green and bug pass**

Run:

```bash
npm test -- tests/core/start.test.ts tests/cli/startIntentRouting.test.ts
npm exec projscan -- start --intent "is this safe to commit?" --format json
npm exec projscan -- bug-hunt --format json
```

Expected: route resolves to before-commit proof and bug pass remains clean.

## Task 3: Trust Memory Ranking

**Files:**
- Modify: `src/core/feedback.ts`
- Modify: `src/core/proofCards.ts`
- Modify: `src/core/assess.ts`
- Test: `tests/core/feedback.test.ts`
- Test: `tests/core/assess.test.ts`

- [ ] **Step 1: Write failing tests**

Add fixture feedback with useful, false-positive, noisy, and suppression-like entries. Assert matching proof cards expose memory context and adjust confidence/ranking deterministically.

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- tests/core/feedback.test.ts tests/core/assess.test.ts
```

Expected: fail because assess does not read or apply feedback memory yet.

- [ ] **Step 3: Implement local memory adapter**

Read an optional feedback artifact path, summarize matching signals, and pass memory into proof-card ranking. Missing files should be ignored with no network access.

- [ ] **Step 4: Verify green and bug pass**

Run:

```bash
npm test -- tests/core/feedback.test.ts tests/core/assess.test.ts
npm exec projscan -- assess --mode fix-first --format json
npm exec projscan -- bug-hunt --format json
```

Expected: memory-aware ranking works and bug pass stays clean.

## Task 4: AgentLoopKit Handoff Packet

**Files:**
- Modify: `src/types/assess.ts`
- Modify: `src/core/proofCards.ts`
- Modify: `src/cli/commands/assess.ts`
- Test: `tests/cli/assess.test.ts`
- Test: `tests/mcp/assess.test.ts`

- [ ] **Step 1: Write failing tests**

Assert CLI JSON and MCP assess output include `agentHandoff` with title, problem, scope, files, constraints, verification commands, rollback, and done criteria.

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- tests/cli/assess.test.ts tests/mcp/assess.test.ts
```

Expected: fail until the handoff packet is present.

- [ ] **Step 3: Implement and render**

Build the packet from card data and show a concise handoff section in Markdown without removing existing content.

- [ ] **Step 4: Verify green and bug pass**

Run:

```bash
npm test -- tests/cli/assess.test.ts tests/mcp/assess.test.ts
npm exec projscan -- assess --mode fix-first --format markdown
npm exec projscan -- bug-hunt --format json
```

Expected: packet is visible and bug pass stays clean.

## Task 5: Simulator Alternative Comparison

**Files:**
- Modify: `src/types/simulate.ts`
- Modify: `src/core/simulate.ts`
- Modify: `src/cli/commands/simulate.ts`
- Test: `tests/core/simulate.test.ts`
- Test: `tests/cli/simulate.test.ts`
- Test: `tests/mcp/simulate.test.ts`

- [ ] **Step 1: Write failing tests**

Assert simulation reports include alternatives for extraction, test-first, and leave-unchanged, with a recommended option and reason.

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- tests/core/simulate.test.ts tests/cli/simulate.test.ts tests/mcp/simulate.test.ts
```

Expected: fail until alternatives are implemented.

- [ ] **Step 3: Implement deterministic alternatives**

Score alternatives from existing candidate files, test matches, contracts, confidence, and risk delta. Keep the existing top-level single-plan fields.

- [ ] **Step 4: Verify green and bug pass**

Run:

```bash
npm test -- tests/core/simulate.test.ts tests/cli/simulate.test.ts tests/mcp/simulate.test.ts
npm exec projscan -- simulate --plan "split bugHunt.ts into ranking, evidence, and output modules" --format json
npm exec projscan -- bug-hunt --format json
```

Expected: alternatives render and bug pass stays clean.

## Task 6: Documentation, Demo, And Copy

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/FIRST-10-MINUTES.md`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`
- Modify: `DECISIONS.md`
- Possibly modify: `scripts/capture-readme-assets.mjs`

- [ ] **Step 1: Update docs tests**

Add or update docs tests so README/GUIDE mention Proof Cards V2, trust memory, AgentLoopKit handoff, safe commit, and simulator alternatives without release claims.

- [ ] **Step 2: Verify red**

Run:

```bash
npm test -- tests/docs/assessDocs.test.ts tests/docs/simulateDocs.test.ts tests/docs/startRoutingDocs.test.ts
```

Expected: fail until docs are updated.

- [ ] **Step 3: Update docs and assets**

Rewrite copy around the one daily trust loop. Regenerate screenshots only if the visible CLI/demo output changed.

- [ ] **Step 4: Verify green and bug pass**

Run:

```bash
npm test -- tests/docs/assessDocs.test.ts tests/docs/simulateDocs.test.ts tests/docs/startRoutingDocs.test.ts
npm run docs:screenshots
npm exec projscan -- bug-hunt --format json
```

Expected: docs tests pass, screenshots generate when needed, and bug pass stays clean.

## Task 7: Performance And Release-Candidate Readiness Without Release

**Files:**
- Modify only if measurement finds a concrete regression.

- [ ] **Step 1: Measure daily commands**

Run:

```bash
time npm exec projscan -- assess --mode fix-first --format json >/tmp/projscan-assess.json
time npm exec projscan -- simulate --plan "split bugHunt.ts into ranking, evidence, and output modules" --format json >/tmp/projscan-simulate.json
time npm exec projscan -- start --intent "is this safe to commit?" --format json >/tmp/projscan-start-safe-commit.json
```

Expected: commands complete without errors and no obvious interactive delay.

- [ ] **Step 2: Run task verification**

Run:

```bash
npm exec agentloop -- verify --task .agentloop/tasks/2026-06-22-proof-cards-v2-daily-trust-loop.md --task-commands --only-task-commands --write-run
npm exec agentloop -- check-gates
npm exec agentloop -- ship
```

Expected: verification and gates pass. `ship` is readiness evidence only; do not release.

- [ ] **Step 3: Handoff and stop for release approval**

Write the final handoff with changed files, tests, performance notes, risks, rollback, and release recommendation. Stop before any version bump, tag, push, publish, deploy, GitHub Release, npm publish, or MCP Registry publication.

## Self-Review

- Spec coverage: all approved product areas map to tasks 1-7.
- Placeholder scan: no open placeholder work remains; each phase has exact files and commands.
- Type consistency: new additive fields are introduced in type files before core, CLI, and MCP use.
- Scope check: this is one product train with independent, testable slices and no release actions.
