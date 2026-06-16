# Review Replies Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a copy-only `projscan start --review-replies` shortcut and saved `review-replies.txt` file backed by `missionControl.reviewGate.decisions`.

**Architecture:** Keep reviewer reply wording centralized in `missionControl.reviewGate.decisions` and reuse the existing `missionReviewReplyLines()` formatter for console output and bundle files. Extend only the CLI command and bundle writer; no core or MCP schema change is needed.

**Tech Stack:** TypeScript, Commander CLI, Vitest, Markdown docs, Playwright-backed README screenshot capture.

---

## File Structure

- Modify `src/cli/commands/start.ts`: add the flag, shortcut handler, print helper, saved bundle file, manifest entry, and shortcut index entry.
- Modify `tests/cli/start.test.ts`: add red tests for the new shortcut, saved file, manifest entry, JSON bundle manifest, and shortcut index.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document the new copy-only reply surface.
- Run `npm run docs:screenshots`; keep generated image changes only if the screenshots differ.

## Task 1: Red CLI Tests

**Files:**

- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Assert saved bundles contain `review-replies.txt`**

In `start writes a Mission Control bundle when requested`, add stdout, README, file content, and manifest expectations:

```ts
expect(result.stdout).toContain('review-replies.txt');
expect(quickstart).toContain(
  '- `review-replies.txt`: Copy-only reviewer reply choices for approving or redirecting the stopped mission.',
);

const reviewReplies = await fs.readFile(path.join(bundleDir, 'review-replies.txt'), 'utf-8');
expect(reviewReplies).toBe(
  [
    '- Approve next slice: Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
    '- Request changes: Changes requested: address the review feedback first, update proof, then stop for another review.',
    '- Review version candidate: Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.',
    '',
  ].join('\n'),
);

expect(manifest.files.map((file: { name: string }) => file.name)).toEqual([
  'README.md',
  'next-command.txt',
  'next-tool-call.json',
  'handoff-prompt.txt',
  'resume-prompt.txt',
  'task-card.md',
  'review-gate.md',
  'review-replies.txt',
  'runbook.md',
  'handoff.json',
  'resume.json',
  'ready-tool-calls.json',
  'proof-commands.txt',
  'manifest.json',
]);
```

- [ ] **Step 2: Assert JSON bundle mode lists the file**

In `start reports the Mission Control bundle as JSON when save-mission uses JSON format`, add `review-replies.txt` to the `arrayContaining` assertion.

- [ ] **Step 3: Add shortcut test**

Add a test:

```ts
test('start prints only reviewer replies when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--review-replies',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toBe(
    [
      '- Approve next slice: Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
      '- Request changes: Changes requested: address the review feedback first, update proof, then stop for another review.',
      '- Review version candidate: Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.',
      '',
    ].join('\n'),
  );
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('# Mission Review Gate');
});
```

- [ ] **Step 4: Assert shortcut index includes the command**

In the shortcut index test, add:

```ts
expect(result.stdout).toContain(
  "projscan start --review-replies --intent 'what breaks if I rename the auth token loader'",
);
```

- [ ] **Step 5: Run red tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission uses JSON format|reviewer replies|shortcut" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because the flag and `review-replies.txt` do not exist yet.

## Task 2: CLI And Bundle Implementation

**Files:**

- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Add the Commander option**

After the existing `--review-gate` option, add:

```ts
.option('--review-replies', 'print only the Mission Control reviewer reply choices')
```

- [ ] **Step 2: Add the shortcut handler**

After the `cmdOpts.reviewGate` branch, add:

```ts
if (cmdOpts.reviewReplies === true) {
  printReviewRepliesOnly(report);
  return;
}
```

- [ ] **Step 3: Write `review-replies.txt`**

After writing `review-gate.md`, add:

```ts
await fs.writeFile(
  path.join(targetDir, 'review-replies.txt'),
  missionReviewReplyLines(report).join('\n') + '\n',
  'utf-8',
);
```

- [ ] **Step 4: Add the bundle file entry**

After the `review-gate.md` entry in `missionBundleFiles()`, add:

```ts
{
  name: 'review-replies.txt',
  path: path.join(targetDir, 'review-replies.txt'),
  description: 'Copy-only reviewer reply choices for approving or redirecting the stopped mission.',
},
```

- [ ] **Step 5: Add the shortcut index entry**

In `printShortcutsOnly()`, add:

```ts
shortcutCommand('--review-replies', options),
```

near `--review-gate`.

- [ ] **Step 6: Add print helper**

After `printReviewGateOnly()`, add:

```ts
function printReviewRepliesOnly(report: StartReport): void {
  const replies = missionReviewReplyLines(report);
  if (replies.length === 0) {
    console.error(chalk.red('No Mission Control reviewer replies are available.'));
    process.exit(1);
  }
  console.log(replies.join('\n'));
}
```

- [ ] **Step 7: Run focused green tests**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission uses JSON format|reviewer replies|shortcut" --test-timeout 60000 --hook-timeout 60000
```

Expected: build passes and focused CLI tests pass.

## Task 3: Docs And Screenshots

**Files:**

- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README**

Add `review-replies.txt` to the saved mission bundle file list and add `--review-replies` to the start shortcut table.

- [ ] **Step 2: Update GUIDE**

In the Mission Control shortcut paragraph, mention `projscan start --review-replies --intent "<goal>"` for copy-only reviewer decisions, and include `review-replies.txt` in the saved bundle list.

- [ ] **Step 3: Update CHANGELOG**

Under `Unreleased > Added`, add:

```md
- Added `projscan start --review-replies` and saved `review-replies.txt` mission bundle files so reviewers can copy approval or change-request replies without opening Markdown or JSON.
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
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md docs/superpowers/specs/2026-06-09-review-replies-export-design.md docs/superpowers/plans/2026-06-09-start-review-replies-export.md
git add docs
git commit -m "feat: export review replies"
```

Do not release, publish, deploy, push, merge, or bump versions.

## Stop Condition

After the implementation commit is created and verification output is recorded, stop and report for human review.
