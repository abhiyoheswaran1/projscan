# Mission Bundle Quick Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a short quick-command workflow to saved mission bundle README files so developers can run, inspect, and review a bundle without reading the full manifest first.

**Architecture:** `missionBundleReadme()` will render one new Markdown section from static script names already present in every saved bundle. Tests will verify section contents and ordering from a real `projscan start --save-mission` run.

**Tech Stack:** TypeScript, Node `fs/promises`, Vitest, Markdown docs.

---

## File Structure

- Modify `tests/cli/start.test.ts`: assert `## Quick Commands`, command order, descriptions, and section ordering in the generated saved bundle README.
- Modify `src/cli/commands/start.ts`: add the quick command section inside `missionBundleReadme()`.
- Modify `README.md`: say saved bundle README files include the quick-command workflow.
- Modify `CHANGELOG.md`: add an unreleased bullet.

## Task 1: Red Tests

- [ ] **Step 1: Add failing README assertions**

In `tests/cli/start.test.ts`, inside `start writes a Mission Control bundle when requested`, after the existing current-step assertions, add:

````ts
expect(quickstart).toContain('## Quick Commands');
expect(quickstart).toContain('```sh\n./mission.sh\n./status.sh\n./review.sh\n```');
expect(quickstart).toContain('- `./mission.sh` runs the current command and remaining proof.');
expect(quickstart).toContain('- `./status.sh` prints the latest mission state.');
expect(quickstart).toContain('- `./review.sh` prints the review packet for approval.');
expect(quickstart.indexOf('## Quick Commands')).toBeLessThan(quickstart.indexOf('## Run Next'));
expect(quickstart.indexOf('## Run Next')).toBeLessThan(quickstart.indexOf('## Reviewer Replies'));
````

- [ ] **Step 2: Run focused test and verify red**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because generated bundle README files do not contain `## Quick Commands`.

## Task 2: README Generation

- [ ] **Step 1: Add quick command Markdown**

In `src/cli/commands/start.ts`, update the `lines` array in `missionBundleReadme()` after the current step metadata and before `## Run Next`:

````ts
'## Quick Commands',
'',
'```sh',
'./mission.sh',
'./status.sh',
'./review.sh',
'```',
'',
'- `./mission.sh` runs the current command and remaining proof.',
'- `./status.sh` prints the latest mission state.',
'- `./review.sh` prints the review packet for approval.',
'',
'## Run Next',
````

- [ ] **Step 2: Run focused test and verify green**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: focused start tests pass.

## Task 3: Docs

- [ ] **Step 1: Update README**

In `README.md`, update the saved bundle paragraph to include:

```md
The saved bundle README starts with quick commands for `./mission.sh`, `./status.sh`, and `./review.sh`.
```

- [ ] **Step 2: Update changelog**

In `CHANGELOG.md`, add:

```md
- Added quick commands to saved mission bundle README files so developers can run `./mission.sh`, `./status.sh`, and `./review.sh` without scanning the manifest.
```

- [ ] **Step 3: Run docs screenshot generation**

Run:

```bash
npm run docs:screenshots
```

Expected: screenshot generation exits `0`. Image files may remain unchanged.

## Task 4: Verification and Commit

- [ ] **Step 1: Build and focused test**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: both exit `0`.

- [ ] **Step 2: Quality gates**

Run:

```bash
npm run lint
git diff --check
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

Expected: all exit `0`.

- [ ] **Step 3: Direct README smoke**

Run:

```bash
tmpdir=$(mktemp -d)
node dist/cli/index.js start --intent 'what breaks if I rename the auth token loader' --save-mission "$tmpdir/mission" --quiet >/tmp/projscan-quick-commands-smoke.out
sed -n '1,32p' "$tmpdir/mission/README.md"
grep -q '## Quick Commands' "$tmpdir/mission/README.md"
grep -q './mission.sh' "$tmpdir/mission/README.md"
grep -q './status.sh' "$tmpdir/mission/README.md"
grep -q './review.sh' "$tmpdir/mission/README.md"
rm -rf "$tmpdir"
rm -f /tmp/projscan-quick-commands-smoke.out
```

Expected: smoke exits `0` and the first page of README shows the quick-command section.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md CHANGELOG.md
git commit -m "docs: add mission bundle quick commands"
```

Expected: commit succeeds. Do not release, publish, deploy, push, merge, or bump the version.

## Self-Review

- The plan covers every design requirement.
- The tests verify both contents and section order.
- The implementation uses existing script names and does not add a new behavior surface.
- The verification plan includes focused tests, full tests, docs screenshots, packed install smoke, and direct README smoke.
