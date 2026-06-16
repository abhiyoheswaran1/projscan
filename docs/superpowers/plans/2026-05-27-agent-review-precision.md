# Agent Review Precision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle several patch-level review/dataflow/ownership/CI improvements into one future 3.0.3 branch without releasing.

**Architecture:** Keep core behavior centralized. `computeReview` owns package scoping before verdict calculation; dataflow path/source classification lives in focused helpers; ownership lookup composes CODEOWNERS with package metadata fallback; CI workflows use verified v5 action tags.

**Tech Stack:** TypeScript, Vitest, GitHub Actions, Node.js release scripts.

---

### Task 1: Core Package-Scoped Review

**Files:**

- Modify: `src/core/review.ts`
- Modify: `src/cli/commands/review.ts`
- Modify: `src/mcp/tools/review.ts`
- Test: `tests/core/review.test.ts`

- [x] Add a failing test where an unsafe change in one workspace package does not block review scoped to another package.
- [x] Scope `PrDiffReport` before changed-file, cycle, risky-function, taint, dataflow, contract, graph evidence, and verdict computation.
- [x] Filter dependency changes by workspace package.
- [x] Pass the package argument from CLI/MCP into `computeReview` instead of post-filtering partial sections.
- [x] Keep package-scoped cycles, package entrypoints, and aggregate graph evidence from leaking across package boundaries.

### Task 2: Framework Request Sources

**Files:**

- Create: `src/core/frameworkSources.ts`
- Modify: `src/core/taint.ts`
- Modify: `src/core/dataflow.ts`
- Test: `tests/core/dataflow.test.ts`

- [x] Add a failing test for `request.json()` inside a Next route handler flowing to `db.query()`.
- [x] Add route-only source mapping for `request.json`, `request.formData`, `request.text`, and `request.arrayBuffer`.
- [x] Prefer route request sources over generic `query` when the route handler also calls a query sink.
- [x] Require receiver-sensitive member calls so `Response.json()` is not treated as `request.json()`.

### Task 3: Generated-Code Dataflow Filter

**Files:**

- Create: `src/core/pathClassifiers.ts`
- Modify: `src/core/dataflowFilters.ts`
- Modify: `src/core/reviewDataflow.ts`
- Modify: `src/cli/commands/dataflow.ts`
- Modify: `src/mcp/tools/dataflow.ts`
- Test: `tests/core/dataflow.test.ts`

- [x] Add a failing test proving generated-only default risks are hidden by default.
- [x] Add an explicit generated-code opt-in for core, CLI, and MCP dataflow.
- [x] Keep custom source/sink risks visible even when generated-code filtering is active.
- [x] Apply the same generated-code rule to review taint/dataflow verdict inputs.

### Task 4: Package Owner Metadata Fallback

**Files:**

- Modify: `src/core/ownership.ts`
- Test: `tests/core/ownership.test.ts`

- [x] Add a failing test for workspace package `projscan.owner` ownership lookup.
- [x] Compose package-owner lookup below CODEOWNERS so CODEOWNERS keeps priority.
- [x] Support `projscan.owner`, `projscan.owners`, `owner`, and `owners` string/array forms.

### Task 5: CI Runtime Hardening

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`

- [x] Verify `actions/checkout` has `v5` / `v5.0.0` tags.
- [x] Verify `actions/setup-node` has `v5` / `v5.0.0` tags.
- [x] Update CI and release workflows to use v5 actions.

### Task 6: Docs and Verification

**Files:**

- Modify: `CHANGELOG.md`
- Modify: `docs/ROADMAP.md`
- Create: `docs/superpowers/specs/2026-05-27-agent-review-precision-design.md`
- Create: `docs/superpowers/plans/2026-05-27-agent-review-precision.md`

- [x] Document the bundled unreleased changes.
- [x] Run focused tests for changed core areas.
- [x] Run build, lint, graph corpus, and stability checks.
- [ ] Open a PR when the branch is ready; do not tag or publish.
