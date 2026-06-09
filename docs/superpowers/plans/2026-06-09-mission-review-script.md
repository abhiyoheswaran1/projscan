# Mission Review Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an executable `review.sh` to saved Mission Control bundles so reviewers can inspect status, proof, review gate text, and allowed replies from one command.

**Architecture:** `writeMissionBundle()` will write one more generated shell script, list it in the manifest file table, and document it in the saved bundle README. A small helper will build the script from the existing review gate commands instead of duplicating review policy data.

**Tech Stack:** TypeScript, Node `fs/promises`, POSIX `sh`, Vitest, Markdown docs.

---

## File Structure

- Modify `tests/cli/start.test.ts`: extend the saved-bundle tests with red coverage for `review.sh` output, manifest entries, executable mode, and initial runtime behavior.
- Modify `src/cli/commands/start.ts`: write `review.sh`, chmod it, list it in `missionBundleFiles()`, and add `buildMissionReviewScript(report)`.
- Modify `README.md`: list `review.sh` in the saved mission bundle documentation.
- Modify `CHANGELOG.md`: add an unreleased bullet for the review script.

## Task 1: Red Tests

- [ ] **Step 1: Add failing saved-bundle assertions**

In `tests/cli/start.test.ts`, extend `start writes a Mission Control bundle when requested`:

```ts
expect(result.stdout).toContain('review.sh');
expect(quickstart).toContain('- `review.sh`: Shell script that prints status, review evidence, run report, and reviewer replies.');

const reviewScript = await fs.readFile(path.join(bundleDir, 'review.sh'), 'utf-8');
expect(reviewScript.startsWith('#!/usr/bin/env sh\nset -eu\n')).toBe(true);
expect(reviewScript).toContain("printf '%s\\n' 'Mission Review'");
expect(reviewScript).toContain('"${MISSION_DIR}/status.sh"');
expect(reviewScript).toContain('status_code=$?');
expect(reviewScript).toContain('review-gate.md');
expect(reviewScript).toContain('proof-logs/run-report.md');
expect(reviewScript).toContain('review-replies.txt');
expect(reviewScript).toContain("printf '%s\\n' '- git status --short'");
expect(reviewScript).toContain("printf '%s\\n' '- git diff --stat'");
expect(reviewScript).toContain('exit "$status_code"');

const reviewMode = (await fs.stat(path.join(bundleDir, 'review.sh'))).mode;
expect(reviewMode & 0o111).not.toBe(0);

const initialReview = await runScript(path.join(bundleDir, 'review.sh'), [], { cwd: bundleDir });
expect(initialReview.exitCode).toBe(2);
expect(initialReview.stdout).toContain('Mission Review');
expect(initialReview.stdout).toContain('Mission status: not_run');
expect(initialReview.stdout).toContain('Review gate: review-gate.md');
expect(initialReview.stdout).toContain('# Mission Review Gate');
expect(initialReview.stdout).toContain('Run report: proof-logs/run-report.md');
expect(initialReview.stdout).toContain('# Mission Run Report');
expect(initialReview.stdout).toContain('Evidence commands');
expect(initialReview.stdout).toContain('- git status --short');
expect(initialReview.stdout).toContain('- git diff --stat');
expect(initialReview.stdout).toContain('Reviewer replies:');
expect(initialReview.stdout).toContain('Approve next slice: Approved: start one more bounded implementation slice.');
```

- [ ] **Step 2: Add manifest and JSON save assertions**

Update the manifest exact file list and JSON save file list to include `review.sh` after `status.sh`:

```ts
'mission.sh',
'status.sh',
'review.sh',
'proof-logs/README.md',
```

- [ ] **Step 3: Run focused test and verify red**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `review.sh` is not written or listed.

## Task 2: Script Generation

- [ ] **Step 1: Write `review.sh` from `writeMissionBundle()`**

In `src/cli/commands/start.ts`, after `status.sh` is written:

```ts
const reviewScriptPath = path.join(targetDir, 'review.sh');
await fs.writeFile(reviewScriptPath, buildMissionReviewScript(report), 'utf-8');
await fs.chmod(reviewScriptPath, 0o755).catch(() => undefined);
```

- [ ] **Step 2: List `review.sh` in bundle metadata**

In `missionBundleFiles()` after `status.sh`:

```ts
{
  name: 'review.sh',
  path: path.join(targetDir, 'review.sh'),
  description: 'Shell script that prints status, review evidence, run report, and reviewer replies.',
},
```

- [ ] **Step 3: Add the script builder**

Add `buildMissionReviewScript(report: StartReport): string` near `buildMissionStatusScript()`:

```ts
function buildMissionReviewScript(report: StartReport): string {
  const evidenceCommands = report.missionControl.reviewGate.commands;
  return [
    '#!/usr/bin/env sh',
    'set -eu',
    '',
    'MISSION_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)',
    'status_code=2',
    '',
    scriptPrint('Mission Review'),
    scriptPrint(''),
    'if [ -x "${MISSION_DIR}/status.sh" ]; then',
    '  set +e',
    '  "${MISSION_DIR}/status.sh"',
    '  status_code=$?',
    '  set -e',
    'else',
    `  ${scriptPrintError('Missing status.sh; run projscan start --save-mission again.')}`,
    'fi',
    '',
    scriptPrint(''),
    scriptPrint('Review gate: review-gate.md'),
    'if [ -f "${MISSION_DIR}/review-gate.md" ]; then',
    '  sed -n \'1,220p\' "${MISSION_DIR}/review-gate.md"',
    'else',
    `  ${scriptPrintError('Missing review-gate.md.')}`,
    'fi',
    '',
    scriptPrint(''),
    scriptPrint('Run report: proof-logs/run-report.md'),
    'if [ -f "${MISSION_DIR}/proof-logs/run-report.md" ]; then',
    '  sed -n \'1,220p\' "${MISSION_DIR}/proof-logs/run-report.md"',
    'else',
    `  ${scriptPrintError('Missing proof-logs/run-report.md. Run ./mission.sh to create proof output.')}`,
    'fi',
    '',
    scriptPrint(''),
    scriptPrint('Evidence commands'),
    ...evidenceCommands.map((command) => scriptPrint(`- ${command}`)),
    '',
    scriptPrint(''),
    scriptPrint('Reviewer replies:'),
    'if [ -f "${MISSION_DIR}/review-replies.txt" ]; then',
    '  cat "${MISSION_DIR}/review-replies.txt"',
    'else',
    `  ${scriptPrintError('Missing review-replies.txt.')}`,
    'fi',
    '',
    'exit "$status_code"',
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Run focused test and verify green**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: focused CLI tests pass.

## Task 3: Docs

- [ ] **Step 1: Update README**

In `README.md`, update the saved bundle paragraph so it mentions `review.sh` after `status.sh` and says:

```md
Run `./review.sh` from the bundle to print the status, review gate, run report, evidence command checklist, and reviewer replies in one terminal view.
```

- [ ] **Step 2: Update changelog**

In `CHANGELOG.md`, add:

```md
- Added saved mission bundle `review.sh`, an executable review surface that prints mission status, review gate text, run report evidence, review commands, and reviewer reply choices.
```

- [ ] **Step 3: Run docs screenshot generation**

Run:

```bash
npm run docs:screenshots
```

Expected: screenshot assets regenerate without error.

## Task 4: Full Verification and Commit

- [ ] **Step 1: Build and focused tests**

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

- [ ] **Step 3: Direct script smoke**

Run:

```bash
tmpdir=$(mktemp -d)
node dist/cli/index.js start --intent 'what breaks if I rename the auth token loader' --save-mission "$tmpdir/mission" --quiet >/tmp/projscan-review-smoke.out
sh -n "$tmpdir/mission/review.sh"
set +e
review_output=$("$tmpdir/mission/review.sh" 2>&1)
review_code=$?
set -e
printf '%s\n' "$review_output"
test "$review_code" -eq 2
printf '%s\n' "$review_output" | grep -q 'Mission Review'
printf '%s\n' "$review_output" | grep -q 'Mission status: not_run'
printf '%s\n' "$review_output" | grep -q 'Reviewer replies:'
rm -rf "$tmpdir"
rm -f /tmp/projscan-review-smoke.out
```

Expected: syntax check passes, script exits `2` in the not-run state, and output includes the review packet headings.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md CHANGELOG.md docs/projscan-proof-router.png
git commit -m "feat: add mission review script"
```

Expected: commit succeeds. Do not release, publish, deploy, push, merge, or bump the version.

## Self-Review

- The plan covers every spec requirement.
- No implementation step depends on unknown file names or undefined helper functions.
- The script prints review evidence commands instead of running git from an uncertain directory.
- The verification scope includes focused tests, full tests, docs screenshots, packed install smoke, and direct shell smoke.
