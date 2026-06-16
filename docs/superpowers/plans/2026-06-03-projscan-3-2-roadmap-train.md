# projscan 3.2 Roadmap Train Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the eight-item projscan roadmap as one unreleased 3.2 implementation train with tests, docs, and release verification.

**Architecture:** Keep the stable CLI/MCP/API surface intact. Add sharper roadmap/adoption/evidence behavior by changing core report builders and their tests, and move roadmap data into focused modules so future product planning changes do not bloat command or reporter surfaces.

**Tech Stack:** TypeScript, Vitest, Node.js CLI, MCP tool wrappers, Markdown docs.

---

### Task 1: Canonical Roadmap And Release Train

**Files:**

- Create: `src/core/roadmapCatalog.ts`
- Modify: `src/core/releaseTrain.ts`
- Modify: `tests/core/releaseTrain.test.ts`
- Modify: `tests/cli/releaseTrainBugHunt.test.ts`
- Modify: `docs/ROADMAP.md`

- [x] **Step 1: Write failing tests**

Add expectations that current `3.1.0` defaults produce eight explicit lines from `3.2.x` through `3.9.x` with themes matching the eight approved workstreams:

```ts
expect(report.plan.lines).toEqual([
  '3.2.x',
  '3.3.x',
  '3.4.x',
  '3.5.x',
  '3.6.x',
  '3.7.x',
  '3.8.x',
  '3.9.x',
]);
expect(report.tracks.map((track) => track.theme)).toEqual([
  'Roadmap Canonicalization',
  'Adoption Proof Polish',
  'PR Evidence Quality',
  'First 10 Minutes UX',
  'Maintainability Hardening',
  'Graph And Dataflow Precision',
  'Plugin Ecosystem',
  'Multi-Agent Coordination',
]);
```

- [x] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/core/releaseTrain.test.ts tests/cli/releaseTrainBugHunt.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: FAIL because defaults still return six generic `3.2.x`-`3.7.x` quality lines.

- [x] **Step 3: Implement catalog-backed release train**

Move track/task definitions for the 3.2 roadmap into `src/core/roadmapCatalog.ts`. Keep legacy 2.x/3.0/3.1 behavior for explicit old line requests. Have `normalizeLines()` use the catalog when the current version is `3.1.x` or newer and no `--line` is passed.

- [x] **Step 4: Run focused tests**

Run: `npx vitest run tests/core/releaseTrain.test.ts tests/cli/releaseTrainBugHunt.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: PASS.

### Task 2: Adoption Proof Polish

**Files:**

- Modify: `src/core/dogfood.ts`
- Modify: `src/core/trial.ts`
- Modify: `tests/core/dogfood.test.ts`
- Modify: `tests/core/trial.test.ts`
- Modify: `docs/ADOPTION-PROOF.md`
- Modify: `docs/MARKET-VALIDATION.md`

- [x] **Step 1: Write failing tests**

Add assertions that market validation exposes a compact `nextProofStep` and `proofGates` list explaining the missing gate in priority order: repo coverage, reviewer feedback, useful responses, value, repeat use, false-positive tuning.

- [x] **Step 2: Verify failure**

Run: `npx vitest run tests/core/dogfood.test.ts tests/core/trial.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: FAIL because `marketValidation.nextProofStep` and `proofGates` do not exist yet.

- [x] **Step 3: Implement proof gates**

Add additive optional fields to `DogfoodMarketValidation`: `proofGates` and `nextProofStep`. Derive them from existing repo coverage, feedback, value, repeat-use, and false-positive state. Roll the same summary into trial output where it already embeds dogfood validation.

- [x] **Step 4: Run focused tests**

Run: `npx vitest run tests/core/dogfood.test.ts tests/core/trial.test.ts tests/cli/dogfood.test.ts tests/cli/trial.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: PASS.

### Task 3: PR Evidence Quality

**Files:**

- Modify: `src/core/releaseEvidence.ts`
- Modify: `tests/core/releaseEvidence.test.ts`
- Modify: `tests/core/releaseEvidencePrCommentFixtures.test.ts`
- Modify: `docs/examples/pr-comments/*.md` when fixture snapshots require updates

- [x] **Step 1: Write failing tests**

Assert that `renderEvidencePackPrComment()` includes a concise `### Reviewer Decision` section with `ship`, `review`, or `fix first`, and that every top risk line contains an owner or an explicit `owner: unassigned` marker plus an exact command.

- [x] **Step 2: Verify failure**

Run: `npx vitest run tests/core/releaseEvidence.test.ts tests/core/releaseEvidencePrCommentFixtures.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: FAIL because the new section is absent.

- [x] **Step 3: Implement PR comment sharpening**

Add the section without removing existing required sections. Keep language calibrated: actual defects, manual review, watch signals, and clean baseline must be distinct.

- [x] **Step 4: Run focused tests**

Run: `npx vitest run tests/core/releaseEvidence.test.ts tests/core/releaseEvidencePrCommentFixtures.test.ts tests/cli/evidenceRegression.test.ts tests/mcp/evidenceRegression.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: PASS.

### Task 4: First 10 Minutes UX

**Files:**

- Modify: `src/core/start.ts`
- Modify: `src/core/adoption.ts`
- Modify: `tests/core/start.test.ts`
- Modify: `tests/core/adoption.test.ts`
- Modify: `tests/cli/start.test.ts`
- Modify: `docs/FIRST-10-MINUTES.md`

- [x] **Step 1: Write failing tests**

Assert that `computeStartReport()` includes a `firstTenMinutes` ordered command path beginning with `projscan privacy-check --offline`, then `projscan start --mode before_edit`, then `projscan preflight --mode before_edit --format json`.

- [x] **Step 2: Verify failure**

Run: `npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/core/adoption.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: FAIL because `firstTenMinutes` does not exist yet.

- [x] **Step 3: Implement guided path**

Add an additive `firstTenMinutes` block to `StartReport` and reuse it in docs and next actions. Keep existing `recommendedWorkflow`, `adoptionLoop`, and `nextActions` intact.

- [x] **Step 4: Run focused tests**

Run: `npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts tests/core/adoption.test.ts tests/cli/adoption.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: PASS.

### Task 5: Maintainability Hardening

**Files:**

- Create: `src/core/roadmapCatalog.ts`
- Create: `src/core/evidenceComment.ts` if PR formatting grows while implementing Task 3
- Modify: `src/core/releaseTrain.ts`
- Modify: `src/core/releaseEvidence.ts`
- Modify: related tests from Tasks 1 and 3

- [x] **Step 1: Verify extraction coverage**

Before extraction, run the focused release train/evidence tests from Tasks 1 and 3.

- [x] **Step 2: Extract stable helpers**

Keep public exports unchanged. Move static roadmap track/task catalog and any bulky PR comment formatting helpers out of the core orchestration functions.

- [x] **Step 3: Run focused tests**

Run: `npx vitest run tests/core/releaseTrain.test.ts tests/core/releaseEvidence.test.ts tests/core/releaseEvidencePrCommentFixtures.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: PASS with no public type or import break.

### Task 6: Graph And Dataflow Precision

**Files:**

- Modify: `src/core/dataflow.ts`
- Modify: `src/core/reviewDataflow.ts`
- Modify: `tests/core/dataflow.test.ts`
- Modify: `tests/core/review.test.ts`

- [x] **Step 1: Write failing tests**

Add a framework-focused fixture that recognizes one additional common request-source pattern without treating unrelated helper calls as request data.

- [x] **Step 2: Verify failure**

Run: `npx vitest run tests/core/dataflow.test.ts tests/core/review.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: FAIL because the new source pattern is not recognized.

- [x] **Step 3: Implement narrowly**

Add only the tested framework pattern and keep generated-code/test-file/broad-file-IO filters unchanged.

- [x] **Step 4: Run focused tests**

Run: `npx vitest run tests/core/dataflow.test.ts tests/core/review.test.ts tests/mcp/semanticGraphDataflow.test.ts tests/cli/semanticGraphDataflow.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: PASS.

### Task 7: Plugin Ecosystem

**Files:**

- Modify: `src/core/pluginDx.ts`
- Modify: `src/core/plugins.ts`
- Modify: `tests/core/pluginDx.test.ts`
- Modify: `tests/cli/pluginDx.test.ts`
- Modify: `docs/PLUGIN-AUTHORING.md`
- Modify: `docs/PLUGIN-GALLERY.md`

- [x] **Step 1: Write failing tests**

Assert plugin test output includes a trust reminder, copied example command, and whether graph/dataflow context was requested by the plugin.

- [x] **Step 2: Verify failure**

Run: `npx vitest run tests/core/pluginDx.test.ts tests/cli/pluginDx.test.ts tests/core/plugins.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: FAIL because the richer test output does not exist.

- [x] **Step 3: Implement plugin DX output**

Add additive fields to plugin test result. Keep plugin manifest schema v1 stable and do not enable plugin execution unless `PROJSCAN_PLUGINS_PREVIEW=1`.

- [x] **Step 4: Run focused tests**

Run: `npx vitest run tests/core/pluginDx.test.ts tests/cli/pluginDx.test.ts tests/core/plugins.test.ts tests/core/pluginPipeline.test.ts tests/mcp/plugin.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: PASS.

### Task 8: Multi-Agent Coordination

**Files:**

- Modify: `src/core/sessionResources.ts`
- Modify: `src/core/agentBrief.ts`
- Modify: `src/core/start.ts`
- Modify: `tests/mcp/sessionResources.test.ts`
- Modify: `tests/core/agentBrief.test.ts`
- Modify: `tests/mcp/agentBriefQualityScorecard.test.ts`

- [x] **Step 1: Write failing tests**

Assert handoff/risk resources include `coordinationHints` with current-worktree vs remembered-session distinction and a next command to resolve conflicts.

- [x] **Step 2: Verify failure**

Run: `npx vitest run tests/mcp/sessionResources.test.ts tests/core/agentBrief.test.ts tests/mcp/agentBriefQualityScorecard.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: FAIL because `coordinationHints` are absent.

- [x] **Step 3: Implement coordination hints**

Add compact additive fields to resources and briefs. Preserve existing resource URIs and top-level payloads.

- [x] **Step 4: Run focused tests**

Run: `npx vitest run tests/mcp/sessionResources.test.ts tests/core/agentBrief.test.ts tests/mcp/agentBriefQualityScorecard.test.ts tests/mcp/sessionIntegration.test.ts --test-timeout 60000 --hook-timeout 60000`

Expected: PASS.

### Final Bug Pass And Release Preparation

- [x] Run `npm test` — 197 files passed, 1549 tests passed, 1 skipped.
- [x] Run `npm run build` — TypeScript build and tool manifest generation passed.
- [x] Run `npm run lint` — ESLint passed.
- [x] Run `npm run check:graph-corpus` — 8 fixtures passed baseline.
- [x] Run `npm run check:stability` — stable surface holds.
- [x] Run `npm run release:check` — blocked as expected on feature branch with uncommitted work; no tag/publish attempted.
- [x] Run `npm run test:trust-smoke` — 13 files passed, 49 tests passed.
- [x] Run `node ./dist/cli/index.js doctor --format json` — health score 100, 0 issues.
- [x] Run `node ./dist/cli/index.js bug-hunt --format json` — completed; output is caution/fix due remembered session context.
- [x] Run `node ./dist/cli/index.js preflight --mode before_merge --format json` — caution from remembered session hotspots, no health/review/supply-chain failures.
- [x] Update `CHANGELOG.md`, `README.md`, and `docs/ROADMAP.md`; package metadata remains unchanged until explicit release approval.
- [x] Ask for explicit approval before any tag, push, or publish command — no release/tag/push/publish command was run in this pass.
