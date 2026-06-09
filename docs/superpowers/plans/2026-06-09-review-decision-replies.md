# Review Decision Replies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add copyable reviewer reply text to `missionControl.reviewGate.decisions` so review handoffs carry exact next-step permission wording.

**Architecture:** Extend the existing deterministic `StartMissionReviewDecision` object with a `reply` field. Reuse the shared `formatMissionReviewDecision` helper so review gate, task card, runbook, CLI shortcuts, saved bundles, JSON, and MCP output stay aligned.

**Tech Stack:** TypeScript, Vitest, Commander CLI, Markdown docs, Playwright-backed docs screenshot capture.

---

## File Structure

- Modify `src/types.ts`: add `reply: string` to `StartMissionReviewDecision`.
- Modify `src/core/start.ts`: add deterministic replies and render them in the shared decision formatter.
- Modify `tests/core/start.test.ts`: assert structured replies and Markdown rendering.
- Modify `tests/cli/start.test.ts`: assert saved bundle and shortcut output include replies.
- Modify `tests/mcp/start.test.ts`: assert MCP output exposes replies.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document copyable reviewer replies.
- Regenerate existing docs screenshots with the repo screenshot script.

## Task 1: Red Tests

**Files:**
- Modify: `tests/core/start.test.ts`
- Modify: `tests/cli/start.test.ts`
- Modify: `tests/mcp/start.test.ts`

- [ ] **Step 1: Add shared expected reply values in focused test scopes**

Use these exact strings in assertions:

```ts
const expectedReviewDecisionReplies = [
  'Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
  'Changes requested: address the review feedback first, update proof, then stop for another review.',
  'Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.',
];
```

- [ ] **Step 2: Add core failing assertions**

In `start exposes a Mission Control task card for MCP and JSON clients`, after the existing decision id assertions, assert:

```ts
expect(report.missionControl.reviewGate.decisions.map((decision) => decision.reply)).toEqual(expectedReviewDecisionReplies);
expect(report.missionControl.reviewGate.markdown).toContain(
  'Reply: "Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version."',
);
expect(report.missionControl.taskCard.markdown).toContain(
  'Reply: "Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version."',
);
expect(report.missionControl.runbook.markdown).toContain(
  'Reply: "Changes requested: address the review feedback first, update proof, then stop for another review."',
);
```

- [ ] **Step 3: Add CLI failing assertions**

In `start writes a Mission Control bundle when requested`, assert:

```ts
expect(reviewGate).toContain(
  'Reply: "Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version."',
);
expect(handoff.reviewGate.decisions.map((decision: { reply: string }) => decision.reply)).toEqual(expectedReviewDecisionReplies);
```

In `start prints only the mission task card when requested`, assert the approve reply appears in stdout.

In `start review-gate shortcut prints the structured review gate markdown`, assert the request-changes reply appears in stdout.

In `start prints only the mission runbook when requested`, assert the version-candidate reply appears in stdout.

- [ ] **Step 4: Add MCP failing assertions**

In `projscan_start returns MCP-callable args for fuzzy impact intents`, assert:

```ts
expect(result.start.missionControl.reviewGate.decisions.map((decision) => decision.reply)).toEqual(expectedReviewDecisionReplies);
expect(result.start.missionControl.reviewGate.markdown).toContain(
  'Reply: "Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version."',
);
```

In the runbook assertions, assert the approve reply appears in runbook Markdown.

- [ ] **Step 5: Run red focused tests**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "task card|Mission Control bundle|review-gate shortcut|mission runbook|fuzzy impact" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `reply` does not exist and Markdown does not render reply text yet.

## Task 2: Core Implementation

**Files:**
- Modify: `src/types.ts`
- Modify: `src/core/start.ts`

- [ ] **Step 1: Extend the public type**

In `StartMissionReviewDecision`, add:

```ts
reply: string;
```

- [ ] **Step 2: Add deterministic replies**

In `buildMissionReviewDecisions`, add the three exact reply strings from Task 1 to the matching decision objects.

- [ ] **Step 3: Render replies once**

Update `formatMissionReviewDecision`:

```ts
function formatMissionReviewDecision(decision: StartMissionReviewDecision): string {
  return `- [ ] ${decision.label}: ${decision.description} Consequence: ${decision.consequence} Reply: "${decision.reply}"`;
}
```

- [ ] **Step 4: Run focused green tests**

Run:

```bash
npm run build
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "task card|Mission Control bundle|review-gate shortcut|mission runbook|fuzzy impact" --test-timeout 60000 --hook-timeout 60000
```

Expected: build and focused tests pass.

## Task 3: Docs And Screenshots

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`
- Possibly modify generated screenshot artifacts if the capture script updates them.

- [ ] **Step 1: Update README**

In the Mission Control overview, change the `missionControl.reviewGate.decisions` sentence to mention copyable reply text for each decision.

- [ ] **Step 2: Update GUIDE**

In the typical agent flow, state that `missionControl.reviewGate.decisions` includes copyable reviewer replies and that agents must still wait for explicit approval before more scope or any release action.

- [ ] **Step 3: Update CHANGELOG**

Under the current `Unreleased` or latest release notes section, add:

```md
- Added copyable `reply` text to `missionControl.reviewGate.decisions` so reviewers can approve another slice, request changes, or request a version-candidate review without inventing permission wording.
```

- [ ] **Step 4: Regenerate docs screenshots**

Run:

```bash
npm run docs:screenshots
```

This script uses Playwright. Keep generated image changes only if the repo script changes screenshot assets.

## Task 4: Verification And Commit

**Files:**
- All changed files.

- [ ] **Step 1: Run full verification**

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

- [ ] **Step 2: Inspect final diff**

Run:

```bash
git status --short
git diff --stat
git diff -- src/types.ts src/core/start.ts tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
```

- [ ] **Step 3: Commit the slice**

Commit with:

```bash
git add src/types.ts src/core/start.ts tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts README.md docs/GUIDE.md CHANGELOG.md docs/superpowers/plans/2026-06-09-review-decision-replies.md
git add docs
git commit -m "feat: add replies to review decisions"
```

Do not release, publish, deploy, push, merge, or bump versions.

## Stop Condition

After the implementation commit is created and verification output is recorded, stop and report for human review.
