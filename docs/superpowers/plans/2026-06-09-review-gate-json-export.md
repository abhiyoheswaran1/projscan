# Review Gate JSON Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a review-gate-only JSON shortcut and saved `review-gate.json` mission bundle file backed by `missionControl.reviewGate`.

**Architecture:** Keep `missionControl.reviewGate` as the source of truth. Add a narrow CLI shortcut, write the same object into saved mission bundles, and update the bundle manifest plus docs.

**Tech Stack:** TypeScript, Commander CLI, Vitest, Markdown docs, Playwright-backed README screenshot capture.

---

## File Structure

- Modify `src/cli/commands/start.ts`: add `--review-gate-json`, a print helper, saved bundle file, manifest entry, and shortcut index entry.
- Modify `tests/cli/start.test.ts`: add red tests for the shortcut, bundle file, manifest file list, JSON bundle mode, and shortcut index.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document the review-gate JSON shortcut and bundle file.
- Run `npm run docs:screenshots`; keep generated image changes only if screenshots differ.

## Task 1: Red CLI Tests

**Files:**
- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Assert saved bundles contain `review-gate.json`**

In `start writes a Mission Control bundle when requested`, add:

```ts
expect(result.stdout).toContain('review-gate.json');
expect(quickstart).toContain('- `review-gate.json`: Machine-readable review gate with policy, proof, decisions, and worktree evidence.');
```

After parsing `handoff`, add:

```ts
const reviewGateJson = JSON.parse(await fs.readFile(path.join(bundleDir, 'review-gate.json'), 'utf-8'));
expect(reviewGateJson).toEqual(handoff.reviewGate);
```

Add `review-gate.json` to the exact manifest file-name order after `review-gate.md`.

- [ ] **Step 2: Assert JSON bundle mode lists the file**

In `start reports the Mission Control bundle as JSON when save-mission uses JSON format`, add `review-gate.json` to the `arrayContaining` expectation.

- [ ] **Step 3: Add shortcut test**

Add this test after the existing `start review-gate shortcut prints the structured review gate markdown` test:

```ts
test('start prints only the review gate JSON when requested', async () => {
  const json = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--format',
    'json',
    '--quiet',
  ]);
  const shortcut = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--review-gate-json',
    '--quiet',
  ]);

  expect(json.exitCode).toBe(0);
  expect(shortcut.exitCode).toBe(0);
  expect(shortcut.stderr).toBe('');
  const report = JSON.parse(json.stdout);
  expect(shortcut.stdout).toBe(`${JSON.stringify(report.missionControl.reviewGate)}\n`);
  const reviewGate = JSON.parse(shortcut.stdout);
  expect(reviewGate.policy).toEqual(expectedReviewPolicy);
  expect(reviewGate.proof.commands).toEqual(report.missionControl.resume.remainingProofCommands);
  expect(reviewGate.worktree.summary).toContain('Current worktree evidence');
  expect(shortcut.stdout).not.toContain('Start:');
  expect(shortcut.stdout).not.toContain('\nMission Control\n');
});
```

- [ ] **Step 4: Assert shortcut index includes the command**

In `start prints a shortcut index for the current mission when requested`, add:

```ts
expect(result.stdout).toContain("projscan start --review-gate-json --intent 'what breaks if I rename the auth token loader'");
```

- [ ] **Step 5: Run red tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission uses JSON format|review gate JSON|shortcut" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `--review-gate-json` and `review-gate.json` do not exist yet.

## Task 2: CLI And Bundle Implementation

**Files:**
- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Add Commander option**

After `--review-gate`, add:

```ts
.option('--review-gate-json', 'print only the Mission Control review gate as JSON')
```

- [ ] **Step 2: Add shortcut handler**

After the `cmdOpts.reviewGate` branch and before `cmdOpts.reviewPolicy`, add:

```ts
if (cmdOpts.reviewGateJson === true) {
  printReviewGateJsonOnly(report);
  return;
}
```

- [ ] **Step 3: Write `review-gate.json`**

After writing `review-gate.md`, add:

```ts
await fs.writeFile(
  path.join(targetDir, 'review-gate.json'),
  JSON.stringify(report.missionControl.reviewGate, null, 2) + '\n',
  'utf-8',
);
```

- [ ] **Step 4: Add bundle file entry**

After the `review-gate.md` entry, add:

```ts
{
  name: 'review-gate.json',
  path: path.join(targetDir, 'review-gate.json'),
  description: 'Machine-readable review gate with policy, proof, decisions, and worktree evidence.',
},
```

- [ ] **Step 5: Add print helper**

After `printReviewGateOnly()`, add:

```ts
function printReviewGateJsonOnly(report: StartReport): void {
  console.log(JSON.stringify(report.missionControl.reviewGate));
}
```

- [ ] **Step 6: Add shortcut index entry**

In `printShortcutsOnly()`, add:

```ts
shortcutCommand('--review-gate-json', options),
```

near `--review-gate`, `--review-policy`, and `--review-replies`.

- [ ] **Step 7: Run focused green tests**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission uses JSON format|review gate JSON|shortcut" --test-timeout 60000 --hook-timeout 60000
```

Expected: build and focused tests pass.

## Task 3: Docs, Screenshots, And Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README**

Add `--review-gate-json` to the Mission Control shortcut block:

```md
projscan start --review-gate-json --intent "<goal>" # Review gate JSON
```

Add `review-gate.json` to the saved mission bundle file list after `review-gate.md`.

Add this row to the options table:

```md
| `--review-gate-json` | Print only the Mission Control review gate as JSON (`start`) |
```

- [ ] **Step 2: Update GUIDE**

In the Mission Control agent flow, mention `projscan start --review-gate-json --intent "<goal>"` for scripts that need proof, worktree evidence, done criteria, decisions, and policy in one review object.

In the shortcut paragraph, include `review-gate.json` in the saved bundle list and add `--review-gate-json` next to `--review-gate`.

- [ ] **Step 3: Update CHANGELOG**

Add this Unreleased bullet near the other review gate bullets:

```md
- Added `projscan start --review-gate-json` and saved `review-gate.json` mission bundle files so agents can read the full review packet without parsing full handoff JSON.
```

- [ ] **Step 4: Run docs scan and screenshots**

Run:

```bash
rg -n "TBD|TODO|implement later|fill in|game changer|beautifully|frictionless|magical|sky is the limit|seamless|robust|powerful|supercharge|delight|leverage" README.md docs/GUIDE.md CHANGELOG.md docs/superpowers/specs/2026-06-09-review-gate-json-export-design.md
npm run docs:screenshots
```

Expected: no new unfinished markers or hype language. Existing historical hits outside the changed prose are acceptable after inspection.

- [ ] **Step 5: Run full verification**

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

Expected: every command exits 0. Known acceptable warnings are the untrusted test plugin warning, HuggingFace 429 semantic fallback, the existing `projscan_start` stability addition, and the packed-install local tarball output.

- [ ] **Step 6: Commit implementation and stop**

Run:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
git commit -m "feat: export review gate json"
git status --short
```

Expected: feature worktree is clean after commit. Do not release, publish, deploy, push, merge, or bump the version.
