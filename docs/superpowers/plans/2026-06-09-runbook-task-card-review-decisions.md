# Runbook Task Card Review Decisions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the existing review-gate decision menu in Mission Control runbooks and task cards.

**Architecture:** Reuse `StartMissionReviewGate.decisions` and `formatMissionReviewDecision` inside the runbook and task-card Markdown renderers. Keep structured JSON/MCP shapes unchanged; this slice only propagates existing review choices to the two primary copyable Markdown artifacts.

**Tech Stack:** TypeScript, Vitest, Commander CLI, Markdown docs.

---

## File Structure

- Modify `src/core/start.ts`: insert a `## Reviewer Decision` section in runbook and task-card Markdown.
- Modify `tests/core/start.test.ts`: assert task card and runbook Markdown contain the decision menu.
- Modify `tests/cli/start.test.ts`: assert `--task-card` and `--runbook` output contain the decision menu.
- Modify `tests/mcp/start.test.ts`: assert MCP runbook Markdown contains the decision menu.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document that task cards and runbooks carry review decisions.

## Task 1: Red Tests

**Files:**
- Modify: `tests/core/start.test.ts`
- Modify: `tests/cli/start.test.ts`
- Modify: `tests/mcp/start.test.ts`

- [ ] **Step 1: Add core failing assertions**

In `start exposes a Mission Control task card for MCP and JSON clients`, after the task-card `## Review Gate` assertion, add:

```ts
expect(report.missionControl.taskCard.markdown).toContain('## Reviewer Decision');
expect(report.missionControl.taskCard.markdown).toContain(
  '- [ ] Approve next slice: The agent may start another bounded implementation slice.',
);
expect(report.missionControl.runbook.markdown).toContain('## Reviewer Decision');
expect(report.missionControl.runbook.markdown).toContain(
  '- [ ] Request changes: The agent must address review feedback before starting more scope.',
);
```

- [ ] **Step 2: Add CLI failing assertions**

In `start prints only the mission task card when requested`, after the `## Review Gate` assertion, add:

```ts
expect(result.stdout).toContain('## Reviewer Decision');
expect(result.stdout).toContain('- [ ] Approve next slice: The agent may start another bounded implementation slice.');
```

In `start prints only the mission runbook when requested`, after the `## Review Gate` assertion, add:

```ts
expect(result.stdout).toContain('## Reviewer Decision');
expect(result.stdout).toContain('- [ ] Review version candidate: The agent may prepare release notes, version rationale, and remaining gates for review.');
```

In `start JSON keeps the full report when runbook shortcut is requested`, after the `## Review Gate` assertion, add:

```ts
expect(report.missionControl.runbook.markdown).toContain('## Reviewer Decision');
```

- [ ] **Step 3: Add MCP failing assertions**

In `projscan_start returns MCP-callable args for fuzzy impact intents`, after the existing runbook `## Handoff Prompt` assertion, add:

```ts
expect(result.start.missionControl.runbook.markdown).toContain('## Reviewer Decision');
expect(result.start.missionControl.runbook.markdown).toContain(
  '- [ ] Approve next slice: The agent may start another bounded implementation slice.',
);
```

- [ ] **Step 4: Run red tests**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "task card|mission task card|mission runbook|full report when runbook|fuzzy impact" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because task-card and runbook Markdown do not render `## Reviewer Decision` yet.

## Task 2: Markdown Implementation

**Files:**
- Modify: `src/core/start.ts`

- [ ] **Step 1: Add decision section to runbook Markdown**

In `renderMissionRunbookMarkdown`, after the `## Review Gate` checklist and before `input.reviewGate.reviewPrompt`, insert:

```ts
'## Reviewer Decision',
...input.reviewGate.decisions.map(formatMissionReviewDecision),
'',
```

The surrounding runbook block becomes:

```ts
'## Review Gate',
...input.reviewGate.checklist.map((item) => `- [ ] ${item}`),
'',
'## Reviewer Decision',
...input.reviewGate.decisions.map(formatMissionReviewDecision),
'',
input.reviewGate.reviewPrompt,
```

- [ ] **Step 2: Add decision section to task-card Markdown**

In `renderMissionTaskCardMarkdown`, after the `## Review Gate` checklist and before `## Handoff Prompt`, insert:

```ts
'## Reviewer Decision',
...input.reviewGate.decisions.map(formatMissionReviewDecision),
'',
```

The surrounding task-card block becomes:

```ts
'## Review Gate',
...input.reviewGate.checklist.map((item) => `- [ ] ${item}`),
'',
'## Reviewer Decision',
...input.reviewGate.decisions.map(formatMissionReviewDecision),
'',
'## Handoff Prompt',
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm run build && npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "task card|mission task card|mission runbook|full report when runbook|fuzzy impact" --test-timeout 60000 --hook-timeout 60000
```

Expected: build passes and focused tests pass.

## Task 3: Docs and Screenshots

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README**

In the Mission Control review-gate paragraph, update the `missionControl.reviewGate.decisions` sentence to:

```md
`missionControl.reviewGate.decisions` gives the reviewer the allowed next choices: approve another slice, request changes, or review a version candidate without publishing; the same menu appears in task-card and runbook Markdown.
```

- [ ] **Step 2: Update GUIDE**

In the typical agent flow paragraph, update the decisions sentence to:

```md
Use `missionControl.reviewGate.decisions` as the approval menu in review gates, task cards, and runbooks so agents do not infer permission to continue, release, or publish.
```

- [ ] **Step 3: Update CHANGELOG**

Under Unreleased / Changed, add:

```md
- Mission task cards and runbooks now render the review-gate decision menu, so paste-ready handoffs show how a reviewer can approve another slice, request changes, or review a version candidate without publishing.
```

- [ ] **Step 4: Regenerate README screenshots**

Run:

```bash
npm run docs:screenshots
```

Expected: exits 0. Include screenshot diffs only if the capture source or PNG output changes.

## Task 4: Verification and Commit

**Files:**
- All modified files

- [ ] **Step 1: Run verification**

Run:

```bash
npm run build
npm run lint
git diff --check
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

Expected: all commands exit 0. Known semantic-model 429 and untrusted sample-plugin warnings are acceptable only when the command exits 0.

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add src/core/start.ts tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
git commit -m "feat: show review decisions in task artifacts"
```

Expected: one feature commit. Do not release, publish, push, deploy, or change `package.json` version.
