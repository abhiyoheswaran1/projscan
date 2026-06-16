# Graph Operations Platform 3.0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the post-3.0 roadmap as one 3.0.1 release with hardened dataflow, graph-backed consumers, cross-repo boundary impact, plugin graph reads, and a golden graph regression corpus.

**Architecture:** Keep the v3 semantic graph as the read contract. Harden dataflow call resolution first, then consume compact graph evidence in review/workplan/brief payloads. Extend existing impact and plugin APIs through optional fields/arguments so current users do not break.

**Tech Stack:** TypeScript, Vitest, existing CLI/MCP tool patterns, existing `CodeGraph`, semantic graph, dataflow, plugin, review, workplan, and impact modules.

---

## File Structure

- Modify `src/core/dataflow.ts`: add scoped callee resolution and confidence rules.
- Modify `src/core/review.ts`: filter/block dataflow risks using confidence and attach compact graph evidence.
- Modify `src/core/workplan.ts`: add graph/dataflow evidence tasks and commands.
- Modify `src/core/agentBrief.ts`: include semantic graph and dataflow context in briefs.
- Modify `src/core/impact.ts`: add cross-repo package/ownership boundary evidence.
- Modify `src/core/plugins.ts` and `src/core/issueEngine.ts`: pass optional read-only graph context to analyzer plugins.
- Create `src/core/graphCorpus.ts`: compute golden graph metrics for fixtures.
- Add tests under `tests/core`, `tests/cli`, and `tests/mcp`.
- Update `src/types.ts`, `src/index.ts`, docs, changelog, roadmap, stability baseline, and package metadata for 3.0.1.

## Task 1: Dataflow False-Positive Hardening

**Files:**

- Modify: `tests/core/dataflow.test.ts`
- Modify: `tests/core/review.test.ts`
- Modify: `src/core/dataflow.ts`
- Modify: `src/core/review.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write failing tests**

Add a dataflow test where unrelated files define `safeParse`, `parse`, and `exec`-touching smoke helpers. Assert no bridge risk is reported unless the bridge can reach source and sink through file-local or unambiguous production call edges.

Add a review test for the current repo-style false positive and assert `newDataflowRisks` excludes the generic `parse` bridge.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/core/dataflow.test.ts tests/core/review.test.ts`
Expected: the new tests fail against the current bare-name global resolution.

- [ ] **Step 3: Implement scoped resolution**

Index functions by file and bare name. For each callee, prefer same-file targets. Allow cross-file targets only when the bare name is not generic and target count is small enough to be meaningful. Add optional `confidenceReason`/`resolution` fields to dataflow risks.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/core/dataflow.test.ts tests/core/review.test.ts`
Expected: pass.

## Task 2: Graph Evidence in Review, Workplan, and Agent Brief

**Files:**

- Modify: `tests/core/review.test.ts`
- Modify: `tests/core/workplan.test.ts`
- Modify: `tests/core/agentBrief.test.ts`
- Modify: `src/core/review.ts`
- Modify: `src/core/workplan.ts`
- Modify: `src/core/agentBrief.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write failing tests**

Assert review returns compact `graphEvidence` with changed files, functions, call edges, and dataflow risk count. Assert workplan review-gate tasks include `projscan_semantic_graph` and graph evidence. Assert agent briefs include graph context counts.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/core/review.test.ts tests/core/workplan.test.ts tests/core/agentBrief.test.ts`
Expected: failures because graph evidence fields are missing.

- [ ] **Step 3: Implement graph evidence**

Build semantic graph/dataflow once per consumer path where feasible. Add compact fields to payloads and keep existing fields unchanged.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/core/review.test.ts tests/core/workplan.test.ts tests/core/agentBrief.test.ts`
Expected: pass.

## Task 3: Cross-Repo Boundary Impact

**Files:**

- Modify: `tests/core/impact.test.ts`
- Modify: `src/core/impact.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write failing tests**

Create local and sibling graphs where a sibling imports a package exposed by the local target. Assert `computeImpact` includes `boundarySummary` with repo totals, package names, and ownership labels.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/core/impact.test.ts`
Expected: boundary assertions fail.

- [ ] **Step 3: Implement boundary summaries**

Extend cross-repo folding to inspect package importers and symbol callers. Add deterministic boundary summaries while preserving existing reachable nodes.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/core/impact.test.ts`
Expected: pass.

## Task 4: Plugin Graph Read Context

**Files:**

- Modify: `tests/core/pluginPipeline.test.ts`
- Modify: `tests/core/plugins.test.ts`
- Modify: `src/core/plugins.ts`
- Modify: `src/core/issueEngine.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write failing tests**

Add a plugin fixture whose `check(rootPath, files, context)` awaits `context.getSemanticGraph()` and emits one issue using graph metrics. Keep an existing two-argument plugin test to prove backward compatibility.

- [ ] **Step 2: Verify RED**

Run: `PROJSCAN_PLUGINS_PREVIEW=1 npm test -- tests/core/pluginPipeline.test.ts tests/core/plugins.test.ts`
Expected: graph-context plugin fails because no context is passed.

- [ ] **Step 3: Implement optional context**

Create a lazy read-only context in `issueEngine`, pass it as a third argument, and cache graph/dataflow construction per scan.

- [ ] **Step 4: Verify GREEN**

Run: `PROJSCAN_PLUGINS_PREVIEW=1 npm test -- tests/core/pluginPipeline.test.ts tests/core/plugins.test.ts`
Expected: pass.

## Task 5: Golden Graph Corpus

**Files:**

- Create: `src/core/graphCorpus.ts`
- Create: `tests/core/graphCorpus.test.ts`
- Modify: `src/index.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Write failing tests**

Assert corpus metrics for `tests/fixtures/{python-small,go-small,rust-small,php-small,csharp-small,kotlin-small,cpp-small,swift-small}` include non-zero files/functions and deterministic graph metric keys.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/core/graphCorpus.test.ts`
Expected: fail because `graphCorpus.ts` does not exist.

- [ ] **Step 3: Implement corpus metrics**

Scan fixture roots, build code graph, semantic graph, and dataflow, then return compact per-fixture metrics.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/core/graphCorpus.test.ts`
Expected: pass.

## Task 6: Docs, Metadata, and Release Wiring

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/STABILITY.md`
- Modify: `.github/mcp-registry/server.json`
- Modify: `stability-baseline.json`

- [ ] **Step 1: Update release metadata**

Bump package metadata to 3.0.1, add changelog entry, update roadmap Now/Recently Completed/Next, and refresh registry/stability metadata.

- [ ] **Step 2: Update user docs**

Document graph-backed consumers, cross-repo boundary impact, plugin graph context, and golden corpus usage.

- [ ] **Step 3: Regenerate generated assets**

Run: `npm run build`
Expected: TypeScript build passes and tool manifest/stability-facing generated files refresh.

## Task 7: Big Bug Hunt and Verification

**Files:**

- Modify files discovered by the bug hunt only when a failing test or tool output proves the issue.

- [ ] **Step 1: Run focused feature tests**

Run all focused commands from Tasks 1-5.

- [ ] **Step 2: Run local product gates**

Run: `npm run lint`, `npm test`, `npm run build`, `npm run check:stability`, `npm run release:check`, `npm run security:release-gate`.

- [ ] **Step 3: Run projscan bug-hunting tools**

Run:

```bash
node ./dist/cli/index.js bug-hunt --format json
node ./dist/cli/index.js quality-scorecard --format json
node ./dist/cli/index.js review --format json
node ./dist/cli/index.js preflight --mode before_merge --format json
node ./dist/cli/index.js dataflow --format json
node ./dist/cli/index.js semantic-graph --format json --max-nodes 200 --max-edges 400
```

Fix every confirmed bug with a failing test first, then rerun the failing command.

## Self-Review

- Spec coverage: all post-3.0 roadmap bullets have tasks.
- Placeholder scan: no TBD/TODO items remain.
- Type consistency: new fields are optional and additive; graph schema remains v3; package release line is 3.0.1.
