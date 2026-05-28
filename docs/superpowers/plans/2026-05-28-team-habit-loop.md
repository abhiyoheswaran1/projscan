# Team Habit Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the automated team habit loop for first PR value and repeated PR usefulness.

**Architecture:** Compose existing projscan primitives: adoption writers, baseline diff, ownership lookup, evidence pack, preflight, workplan, MCP config guides, and plugin examples. Keep new behavior additive and JSON-compatible.

**Tech Stack:** TypeScript, Commander CLI, Vitest, existing projscan core modules, local JSON artifacts.

---

### Task 1: PR Evidence Hero Surface

**Files:** `src/core/releaseEvidence.ts`, `src/types.ts`, `tests/core/releaseEvidence.test.ts`, `tests/cli/evidenceRegression.test.ts`

- [ ] Write failing tests that `--pr-comment` includes short verdict, top risks, baseline trend, owner routing, suggested next actions, and verification.
- [ ] Implement additive PR summary fields on `EvidencePackReport`.
- [ ] Load baseline trend only when `.projscan-baseline.json` exists.
- [ ] Use ownership lookup for top risk files.
- [ ] Verify focused evidence tests pass.

### Task 2: Team Bootstrap Command

**Files:** `src/core/adoption.ts`, `src/cli/commands/init.ts`, `src/utils/formatSupport.ts`, `tests/core/adoption.test.ts`, `tests/cli/adoption.test.ts`

- [ ] Write failing tests for `projscan init team --team security --format json`.
- [ ] Create policy, PR workflow, CODEOWNERS starter, and `.projscan-baseline.json` without unsafe overwrites.
- [ ] Return `start` orientation in CLI JSON.
- [ ] Print compact console output with next commands.
- [ ] Verify focused adoption tests pass.

### Task 3: Baseline Trend Memory

**Files:** `src/utils/baseline.ts`, `src/types.ts`, `tests/utils/baselineHotspots.test.ts`

- [ ] Write failing tests for score direction, new hotspots, and recurring noisy rules.
- [ ] Extend baseline snapshots with issue rule counts.
- [ ] Extend diff results with trend summary.
- [ ] Keep old baseline files readable.
- [ ] Verify baseline tests pass.

### Task 4: MCP Setup Verification

**Files:** `src/core/adoption.ts`, `src/cli/commands/mcp.ts`, `src/utils/formatSupport.ts`, `tests/cli/adoption.test.ts`, `tests/mcp/adoption.test.ts`

- [ ] Write failing tests for `projscan mcp doctor --client codex --format json`.
- [ ] Return setup checks, exact command, paste target, config text, and next commands.
- [ ] Add `mcp_doctor` action to `projscan_adoption` without adding a new MCP tool.
- [ ] Verify CLI and MCP adoption tests pass.

### Task 5: Ownership Routing in Workplans

**Files:** `src/core/workplan.ts`, `src/types.ts`, `tests/core/workplan.test.ts`

- [ ] Write failing tests where CODEOWNERS maps a risk file to an owner.
- [ ] Add optional `owner` to workplan tasks and top risks.
- [ ] Preserve existing task ranking and commands.
- [ ] Verify workplan tests pass.

### Task 6: Real-World Plugin Examples

**Files:** `docs/examples/plugins/*`, `tests/core/pluginDx.test.ts` or `tests/core/plugins.test.ts`, `docs/PLUGIN-GALLERY.md`

- [ ] Write failing tests that the three new plugin manifests validate.
- [ ] Add API route ownership, security-sensitive file, and monorepo boundary analyzer examples.
- [ ] Update gallery docs.
- [ ] Verify plugin tests pass.

### Task 7: Verification and Bug Hunt

**Files:** repository-wide

- [ ] Run `npm run build`.
- [ ] Run focused tests for changed areas.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `projscan preflight --mode before_commit --format json`.
- [ ] Run `projscan bug-hunt --format json` and address concrete issues.
- [ ] Commit locally without release, tag, push, or version bump.
