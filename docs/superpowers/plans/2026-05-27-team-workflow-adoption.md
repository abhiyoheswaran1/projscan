# Team Workflow Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add workflow surfaces that make projscan habit-forming for individual developers and engineering teams.

**Architecture:** Keep behavior in focused `src/core/*` modules and expose it through thin CLI and MCP wrappers. Reuse existing first-run diagnostics, recipes, workplans, quality scorecards, and evidence packs instead of creating parallel scans.

**Tech Stack:** TypeScript, Commander CLI, MCP tool registry, Vitest.

---

### Task 1: Start Workflow

**Files:**

- Create: `src/core/start.ts`
- Create: `src/cli/commands/start.ts`
- Create: `src/mcp/tools/start.ts`
- Modify: `src/cli/index.ts`
- Modify: `src/mcp/tools.ts`
- Modify: `src/types.ts`
- Modify: `src/utils/formatSupport.ts`
- Test: `tests/core/start.test.ts`
- Test: `tests/cli/start.test.ts`
- Test: `tests/mcp/start.test.ts`

- [x] Write failing core, CLI, and MCP tests for `projscan start`.
- [x] Implement `computeStartReport()` by composing existing core reports.
- [x] Add CLI and MCP wrappers.
- [x] Run focused tests.

### Task 2: Policy Starter Kits

**Files:**

- Modify: `src/core/adoption.ts`
- Modify: `src/cli/commands/init.ts`
- Modify: `src/utils/formatSupport.ts`
- Test: `tests/core/adoption.test.ts`
- Test: `tests/cli/adoption.test.ts`

- [x] Write failing tests for `projscan init policy --team security|frontend|platform|monorepo`.
- [x] Implement policy templates and overwrite protection.
- [x] Run focused tests.

### Task 3: Handoff Artifact

**Files:**

- Modify: `src/core/workplan.ts`
- Modify: `src/cli/commands/workplan.ts`
- Test: `tests/core/workplan.test.ts`
- Test: `tests/cli/workplan.test.ts`

- [x] Write failing tests for structured handoff payload and `--write`.
- [x] Export a reusable `buildHandoffPayload()`.
- [x] Write the markdown handoff file when requested.
- [x] Run focused tests.

### Task 4: PR Comment Renderer

**Files:**

- Modify: `src/core/releaseEvidence.ts`
- Modify: `src/cli/commands/evidencePack.ts`
- Test: `tests/core/releaseEvidence.test.ts`
- Test: `tests/cli/evidenceRegression.test.ts`

- [x] Write failing tests for `--pr-comment`.
- [x] Render approval evidence as concise markdown.
- [x] Run focused tests.

### Task 6: GitHub Action Starter

**Files:**

- Modify: `src/core/adoption.ts`
- Modify: `src/cli/commands/init.ts`
- Modify: `src/utils/formatSupport.ts`
- Test: `tests/core/adoption.test.ts`
- Test: `tests/cli/adoption.test.ts`

- [x] Write failing tests for `projscan init github-action`.
- [x] Implement the workflow template and overwrite protection.
- [x] Run focused tests.

### Task 5: Verification

**Files:**

- Modify docs and README command lists only after code is green.

- [x] Run `npm run build`.
- [x] Run focused tests.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Stop without tag, publish, or release.
