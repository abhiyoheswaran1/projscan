# 3.0.2 Agent Graph Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one patch release that hardens graph/dataflow/release readiness and makes impact/release planning more useful for agents.

**Architecture:** Keep changes additive. Dataflow filtering remains in `src/core/dataflowFilters.ts`; release gating stays in existing scripts/workflows; impact ownership is isolated in a new core helper and passed into existing impact computation; release-train data stays in the current planner.

**Tech Stack:** TypeScript, Vitest, GitHub Actions, Node.js release scripts.

---

### Task 1: Dataflow Custom Rule Visibility

**Files:**
- Modify: `src/core/dataflowFilters.ts`
- Modify: `tests/core/dataflow.test.ts`

- [ ] Write a failing test where default `readFile` flows into custom sink `sendRemote` and remains visible.
- [ ] Run `npm test -- tests/core/dataflow.test.ts` and confirm the test fails.
- [ ] Adjust broad file-I/O suppression so custom source/sink participation bypasses the broad default filter.
- [ ] Run `npm test -- tests/core/dataflow.test.ts` and confirm it passes.

### Task 2: Release Gate Hardening

**Files:**
- Modify: `scripts/release-check.mjs`
- Modify: `tests/scripts/releaseCheck.test.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`

- [ ] Add a failing test proving `release:check` blocks when `origin` already has the version tag but its peeled commit differs from `HEAD`.
- [ ] Add a failing test proving the graph corpus gate is part of the release gate runner list.
- [ ] Add remote peeled-tag parsing and a blocking `remote-tag` state for mismatches.
- [ ] Add `npm run check:graph-corpus` to release-check, CI, and release workflow.
- [ ] Run `npm test -- tests/scripts/releaseCheck.test.ts` and `npm run check:graph-corpus`.

### Task 3: Impact Ownership Metadata

**Files:**
- Create: `src/core/ownership.ts`
- Modify: `src/core/impact.ts`
- Modify: `src/mcp/tools/impact.ts`
- Modify: `tests/core/impact.test.ts`

- [ ] Add a failing test where cross-repo package boundary files are owned by CODEOWNERS and `boundarySummary.owner` reflects that owner.
- [ ] Implement lightweight CODEOWNERS loading and matching.
- [ ] Pass per-repo ownership lookups from the MCP cross-repo builder into `computeImpact`.
- [ ] Run `npm test -- tests/core/impact.test.ts`.

### Task 4: 3.x Release Train Polish

**Files:**
- Modify: `src/core/releaseTrain.ts`
- Modify: `tests/core/releaseTrain.test.ts`

- [ ] Add failing tests for `3.0.x` / `3.1.x` release lines.
- [ ] Add graph-platform release line plans without changing the JSON schema.
- [ ] Run `npm test -- tests/core/releaseTrain.test.ts`.

### Task 5: 3.0.2 Release Metadata

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/mcp-registry/server.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/ROADMAP.md`

- [ ] Bump version metadata to `3.0.2`.
- [ ] Add a `3.0.2` changelog entry covering all shipped changes.
- [ ] Update roadmap Now/Recently Shipped entries for 3.0.2.
- [ ] Run `npm install --package-lock-only` if lock metadata needs refresh.

### Task 6: Verification and Release

**Files:**
- No code changes expected.

- [ ] Run `npm run build`.
- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run check:stability`.
- [ ] Run `npm run security:release-gate`.
- [ ] Run `npm run check:graph-corpus`.
- [ ] Run `npm run smoke:packed-install`.
- [ ] Open PR, wait for CI, merge to `main`.
- [ ] Pull clean current `main`, run `npm run release:check`.
- [ ] Tag `v3.0.2` from `main` only and publish through the release workflow.
- [ ] Verify npm, GitHub Release, MCP Registry, remote heads, open PRs, and local cleanliness.
