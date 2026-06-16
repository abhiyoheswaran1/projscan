# Runbook Handoff Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the existing resume-aware handoff prompt inside full Markdown mission runbooks.

**Architecture:** Reuse the existing `missionHandoffPrompt(...)` string instead of creating a second formatter. Compute it once in `buildMissionControl`, pass it through runbook construction, and render it as a Markdown section after `## Resume`.

**Tech Stack:** TypeScript, Vitest, projscan CLI/MCP start tests.

---

### Task 1: Add Failing Coverage

**Files:**

- Modify: `tests/core/start.test.ts`
- Modify: `tests/cli/start.test.ts`
- Modify: `tests/mcp/start.test.ts`

- [ ] **Step 1: Add core runbook assertions**

In the fuzzy Mission Control runbook test, assert that `runbook.markdown` contains `## Handoff Prompt`, contains `report.missionControl.handoffPrompt`, and orders the section after `## Resume` and before `## Ready Commands`.

- [ ] **Step 2: Add CLI runbook assertions**

In `start console renders a compact agent runbook when handoff is requested`, assert that stdout contains `## Handoff Prompt`, contains the expected resume-aware prompt text, and orders the section after `## Resume` and before `## Ready Commands`.

- [ ] **Step 3: Add MCP runbook assertions**

In the MCP fuzzy start test, assert that `result.start.missionControl.runbook.markdown` contains `## Handoff Prompt` and contains `result.start.missionControl.handoffPrompt`.

- [ ] **Step 4: Verify red**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: failing assertions for missing `## Handoff Prompt`.

### Task 2: Render The Handoff Prompt

**Files:**

- Modify: `src/core/start.ts`

- [ ] **Step 1: Compute the prompt before runbook construction**

Move the existing `whyNow` calculation above `buildMissionRunbook`, compute:

```ts
const handoffPrompt = missionHandoffPrompt(
  resume,
  successCriteria,
  whyNow,
  unresolvedInputs,
  proofCommands,
);
```

- [ ] **Step 2: Pass the prompt to runbook rendering**

Add `handoffPrompt: string` to the `buildMissionRunbook` and `renderMissionRunbookMarkdown` inputs, pass the computed value through, and return that same value as `missionControl.handoffPrompt`.

- [ ] **Step 3: Insert the Markdown section**

Insert the following lines after `renderRunbookResumeLines(input.resume)` and before `## Ready Commands`:

```ts
'## Handoff Prompt',
input.handoffPrompt,
'',
```

- [ ] **Step 4: Verify green**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: all selected tests pass.

### Task 3: Update Product Docs And Verify

**Files:**

- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Document the runbook section**

Update Mission Control docs to say full Markdown runbooks render the same copyable handoff prompt as `## Handoff Prompt`.

- [ ] **Step 2: Update examples**

Add the `## Handoff Prompt` section to the README runbook example after the `Prompt:` line and before `## Ready Commands`.

- [ ] **Step 3: Run verification**

Run build, focused tests, lint, diff check, live CLI sanity, full tests, stability, release gate, graph corpus, packed install smoke, and then inspect `git status --short`.

- [ ] **Step 4: Commit locally**

Commit the implementation with:

```bash
git commit -m "feat: add handoff prompt to runbook"
```
