# projscan 3.3.0 Release Preparation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare projscan 3.3.0 with verified roadmap behavior, corrective release-quality patches, exact changelog scope, and synced release metadata.

**Architecture:** Keep the existing stable CLI, MCP, and public TypeScript contracts additive. Patch only verified gaps from the roadmap audit, then bump release metadata and regenerate built artifacts from the source of truth.

**Tech Stack:** TypeScript, Vitest, Node.js CLI, MCP resources, Markdown docs, npm release metadata.

---

### Task 1: Close Roadmap Audit Gaps

**Files:**

- Modify: `tests/core/adoption.test.ts`
- Modify: `src/core/adoption.ts`
- Modify: `tests/core/start.test.ts`
- Modify: `tests/cli/start.test.ts`
- Modify: `src/core/start.ts`
- Modify: `src/cli/commands/start.ts`
- Create: `src/core/evidenceComment.ts`
- Modify: `src/core/releaseEvidence.ts`

- [ ] **Step 1: Write failing tests**

Add tests that prove:

- Generated GitHub Action PR-comment validation requires `### Reviewer Decision`.
- `computeStartReport()` exposes `coordinationHints` with current-worktree and remembered-session commands.
- Human `projscan start` console output shows the full first-ten-minutes path and coordination hints.

- [ ] **Step 2: Verify red**

Run:

```bash
npx vitest run tests/core/adoption.test.ts tests/core/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm run build
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: tests fail before implementation because `Reviewer Decision` is not required by the generated workflow validator and `StartReport` has no direct `coordinationHints`.

- [ ] **Step 3: Implement minimal fixes**

Add the missing required section to the generated workflow validator. Add additive `coordinationHints` to `StartReport`, derived from the current worktree/session split. Print a compact first-ten-minutes and coordination-hints section in human start output. Extract PR-comment rendering/validation helpers from `releaseEvidence.ts` into `evidenceComment.ts` without changing exported behavior.

- [ ] **Step 4: Verify green**

Run:

```bash
npx vitest run tests/core/adoption.test.ts tests/core/start.test.ts tests/core/releaseEvidence.test.ts tests/core/releaseEvidencePrCommentFixtures.test.ts --test-timeout 60000 --hook-timeout 60000
npm run build
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: focused tests pass and generated CLI artifacts reflect the start output changes.

### Task 2: Prepare 3.3.0 Release Metadata

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/mcp-registry/server.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`
- Modify: `README.md`
- Regenerate: `dist/tool-manifest.json`
- Regenerate: `dist/projscan-sbom.cdx.json`

- [ ] **Step 1: Sync versions**

Set package, lockfile root, and MCP Registry versions to `3.3.0`. Update README tag links from `v3.2.0` to `v3.3.0` and the website update prompt to projscan `3.3.0`.

- [ ] **Step 2: Write exact changelog entry**

Add `## [3.3.0] - 2026-06-03` with exact included changes: adoption proof gates, reviewer decision evidence, first-ten-minutes path, Hono dataflow precision, plugin trust guidance, coordination hints, start console visibility, generated workflow validation, and evidence helper extraction. Do not describe the release as combining future roadmap lines.

- [ ] **Step 3: Regenerate release artifacts**

Run:

```bash
npm run build
npm run sbom:generate
```

Expected: dist metadata reflects `3.3.0` and current source.

### Task 3: Release Verification

**Files:**

- Verify only unless a gate fails.

- [ ] **Step 1: Focused verification**

Run:

```bash
npm test -- tests/core/dogfood.test.ts tests/core/trial.test.ts tests/core/releaseEvidence.test.ts tests/core/start.test.ts tests/cli/start.test.ts tests/core/dataflow.test.ts tests/core/pluginDx.test.ts tests/core/agentBrief.test.ts tests/mcp/sessionResources.test.ts tests/core/releaseTrain.test.ts tests/mcp/releaseWorkflow.test.ts tests/core/adoption.test.ts
```

- [ ] **Step 2: Full release gates**

Run:

```bash
npm test
npm run build
npm run lint
npm run check:graph-corpus
npm run check:stability
npm run release:check -- --skip-remote
```

Expected: all local gates pass before tagging `v3.3.0`.
