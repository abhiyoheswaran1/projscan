# Review Replies First Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show copyable reviewer replies in the default `projscan start` review gate and saved mission bundle quickstart README.

**Architecture:** Reuse `missionControl.reviewGate.decisions` as the single source of reviewer reply text. Add small CLI formatting helpers in `src/cli/commands/start.ts`, then call them from the default review-gate console renderer and mission bundle README builder.

**Tech Stack:** TypeScript, Commander CLI, Vitest, Markdown docs, Playwright-backed README screenshot capture.

---

## File Structure

- Modify `src/cli/commands/start.ts`: add reviewer reply formatters and render replies in first surfaces.
- Modify `tests/cli/start.test.ts`: add red assertions for default console output and saved mission bundle README.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document the new first-surface reply visibility.
- Run `npm run docs:screenshots`; keep generated image changes only when the script changes assets.

## Task 1: Red Tests

**Files:**

- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add default console assertions**

In `start console renders mission control before generic next actions`, after the existing `Review Gate` assertions, add:

```ts
expect(result.stdout).toContain('Reviewer Replies');
expect(result.stdout).toContain(
  '- Approve next slice: Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
);
expect(result.stdout).toContain(
  '- Request changes: Changes requested: address the review feedback first, update proof, then stop for another review.',
);
expect(result.stdout).toContain(
  '- Review version candidate: Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.',
);
expect(result.stdout.indexOf('Reviewer Replies')).toBeLessThan(
  result.stdout.indexOf('Action Plan'),
);
```

- [ ] **Step 2: Add bundle README assertions**

In `start writes a Mission Control bundle when requested`, after the existing quickstart file-list assertions, add:

```ts
expect(quickstart).toContain('## Reviewer Replies');
expect(quickstart).toContain(
  '- Approve next slice: Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
);
expect(quickstart).toContain(
  '- Request changes: Changes requested: address the review feedback first, update proof, then stop for another review.',
);
expect(quickstart).toContain(
  '- Review version candidate: Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.',
);
expect(quickstart.indexOf('## Reviewer Replies')).toBeLessThan(quickstart.indexOf('## Files'));
```

- [ ] **Step 3: Run red tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "mission control before generic next actions|Mission Control bundle" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because default console output and bundle README do not render `Reviewer Replies`.

## Task 2: CLI Implementation

**Files:**

- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Add shared reply line formatter**

Add near `printReviewGate`:

```ts
function missionReviewReplyLines(report: StartReport): string[] {
  return report.missionControl.reviewGate.decisions.map(
    (decision) => `- ${decision.label}: ${decision.reply}`,
  );
}
```

- [ ] **Step 2: Add console printer**

Add after `missionReviewReplyLines`:

```ts
function printReviewReplies(report: StartReport): void {
  const replies = missionReviewReplyLines(report);
  if (replies.length === 0) return;
  console.log(chalk.bold('Reviewer Replies'));
  for (const reply of replies) console.log(reply);
}
```

- [ ] **Step 3: Render replies in default review gate**

In `printReviewGate`, after `console.log(gate.worktree.summary);`, add:

```ts
printReviewReplies(report);
```

- [ ] **Step 4: Render replies in mission bundle README**

In `missionBundleReadme`, after the MCP call block and before `## Files`, insert:

```ts
const reviewReplyLines = missionReviewReplyLines(report);
if (reviewReplyLines.length > 0) {
  lines.push('', '## Reviewer Replies', '', ...reviewReplyLines);
}
```

- [ ] **Step 5: Run focused green tests**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts --testNamePattern "mission control before generic next actions|Mission Control bundle" --test-timeout 60000 --hook-timeout 60000
```

Expected: build and focused tests pass.

## Task 3: Docs And Screenshots

**Files:**

- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`
- Possibly modify generated screenshot assets if the capture script updates them.

- [ ] **Step 1: Update README**

In the Mission Control overview paragraph, change the sentence about `missionControl.reviewGate.decisions` to say the same reply menu appears in default console output and saved bundle README files.

- [ ] **Step 2: Update GUIDE**

In the typical agent flow paragraph, state that default console review gates and saved bundle quickstarts show reviewer replies inline.

- [ ] **Step 3: Update CHANGELOG**

Under `Unreleased > Added`, add:

```md
- Added reviewer replies to the default `projscan start` review-gate output and saved mission bundle `README.md` files, so first-open review surfaces show the copyable approval text.
```

- [ ] **Step 4: Run docs screenshot capture**

Run:

```bash
npm run docs:screenshots
```

If PNGs change, inspect the changed image before committing.

## Task 4: Verification And Commit

**Files:**

- All changed files.

- [ ] **Step 1: Run verification**

Run:

```bash
npm run build
npm run lint
git diff --check
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
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
git diff -- src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
```

- [ ] **Step 3: Commit the slice**

Commit with:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md docs/superpowers/plans/2026-06-09-review-replies-first-surfaces.md
git add docs
git commit -m "feat: show review replies in first surfaces"
```

Do not release, publish, deploy, push, merge, or bump versions.

## Stop Condition

After the implementation commit is created and verification output is recorded, stop and report for human review.
