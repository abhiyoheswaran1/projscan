# Review Policy Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a policy-only `projscan start --review-policy` shortcut and saved `review-policy.json` mission bundle file backed by `missionControl.reviewGate.policy`.

**Architecture:** Keep `missionControl.reviewGate.policy` as the source of truth. Add a narrow CLI shortcut, write the same object into saved mission bundles, and update the bundle manifest plus docs.

**Tech Stack:** TypeScript, Commander CLI, Vitest, Markdown docs, Playwright-backed README screenshot capture.

---

## File Structure

- Modify `src/cli/commands/start.ts`: add `--review-policy`, a print helper, saved bundle file, manifest entry, and shortcut index entry.
- Modify `tests/cli/start.test.ts`: add red tests for the shortcut, bundle file, manifest file list, JSON bundle mode, and shortcut index.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document the policy-only shortcut and bundle file.
- Run `npm run docs:screenshots`; keep generated image changes only if screenshots differ.

## Task 1: Red CLI Tests

**Files:**

- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add expected policy helper**

Near the existing `expectedReviewReplyLines`, add:

```ts
const expectedReviewPolicy = {
  approvalRequired: true,
  blockedActions: ['next_slice', 'release', 'publish', 'deploy', 'push', 'merge', 'version_bump'],
  summary:
    'Explicit reviewer approval is required before another slice, release, publish, deploy, push, merge, or version bump.',
};
```

- [ ] **Step 2: Assert saved bundles contain `review-policy.json`**

In `start writes a Mission Control bundle when requested`, add:

```ts
expect(result.stdout).toContain('review-policy.json');
expect(quickstart).toContain(
  '- `review-policy.json`: Machine-readable review approval boundary and blocked actions.',
);

const reviewPolicy = JSON.parse(
  await fs.readFile(path.join(bundleDir, 'review-policy.json'), 'utf-8'),
);
expect(reviewPolicy).toEqual(expectedReviewPolicy);
```

After parsing `handoff`, add:

```ts
expect(handoff.reviewGate.policy).toEqual(expectedReviewPolicy);
expect(reviewPolicy).toEqual(handoff.reviewGate.policy);
```

Add `review-policy.json` to the exact manifest file-name order after `review-gate.md`.

- [ ] **Step 3: Assert JSON bundle mode lists the file**

In `start reports the Mission Control bundle as JSON when save-mission uses JSON format`, add `review-policy.json` to the `arrayContaining` expectation.

- [ ] **Step 4: Add shortcut test**

Add:

```ts
test('start prints only the review policy when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--review-policy',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toBe(`${JSON.stringify(expectedReviewPolicy)}\n`);
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('# Mission Review Gate');
});
```

- [ ] **Step 5: Assert shortcut index includes the command**

In `start prints a shortcut index for the current mission when requested`, add:

```ts
expect(result.stdout).toContain(
  "projscan start --review-policy --intent 'what breaks if I rename the auth token loader'",
);
```

- [ ] **Step 6: Run red tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission uses JSON format|review policy|shortcut" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `--review-policy` and `review-policy.json` do not exist yet.

## Task 2: CLI And Bundle Implementation

**Files:**

- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Add Commander option**

After `--review-gate`, add:

```ts
.option('--review-policy', 'print only the Mission Control review policy as JSON')
```

- [ ] **Step 2: Add shortcut handler**

After the `cmdOpts.reviewGate` branch, add:

```ts
if (cmdOpts.reviewPolicy === true) {
  printReviewPolicyOnly(report);
  return;
}
```

- [ ] **Step 3: Write `review-policy.json`**

After writing `review-gate.md`, add:

```ts
await fs.writeFile(
  path.join(targetDir, 'review-policy.json'),
  JSON.stringify(report.missionControl.reviewGate.policy, null, 2) + '\n',
  'utf-8',
);
```

- [ ] **Step 4: Add bundle file entry**

After the `review-gate.md` entry, add:

```ts
{
  name: 'review-policy.json',
  path: path.join(targetDir, 'review-policy.json'),
  description: 'Machine-readable review approval boundary and blocked actions.',
},
```

- [ ] **Step 5: Add print helper**

After `printReviewGateOnly()`, add:

```ts
function printReviewPolicyOnly(report: StartReport): void {
  console.log(JSON.stringify(report.missionControl.reviewGate.policy));
}
```

- [ ] **Step 6: Add shortcut index entry**

In `printShortcutsOnly()`, add:

```ts
shortcutCommand('--review-policy', options),
```

near `--review-gate` and `--review-replies`.

- [ ] **Step 7: Run focused green tests**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission uses JSON format|review policy|shortcut" --test-timeout 60000 --hook-timeout 60000
```

Expected: build and focused tests pass.

## Task 3: Docs And Screenshots

**Files:**

- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README**

Add `--review-policy` to the shortcut list and CLI flag table. Add `review-policy.json` to the saved bundle file list.

- [ ] **Step 2: Update GUIDE**

In the shortcut paragraph, mention `projscan start --review-policy --intent "<goal>"` and include `review-policy.json` in the saved bundle list.

- [ ] **Step 3: Update CHANGELOG**

Under `Unreleased > Added`, add:

```md
- Added `projscan start --review-policy` and saved `review-policy.json` mission bundle files so agents can read the review approval boundary without parsing full handoff JSON.
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
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md docs/superpowers/specs/2026-06-09-review-policy-export-design.md docs/superpowers/plans/2026-06-09-review-policy-export.md
git commit -m "feat: export review policy"
```

Do not release, publish, deploy, push, merge, or bump versions.

## Stop Condition

After the implementation commit is created and verification output is recorded, stop and report for human review.
