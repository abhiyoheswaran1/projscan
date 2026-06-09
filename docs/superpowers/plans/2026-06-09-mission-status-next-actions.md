# Mission Status Next Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add next-action guidance to generated `status.sh` output so saved mission bundles tell developers what to do for each mission state.

**Architecture:** `buildMissionStatusScript()` will print one `Next action:` line from the parsed summary status. `review.sh` will inherit this line because it already calls `status.sh`.

**Tech Stack:** TypeScript, Node `fs/promises`, generated POSIX `sh`, Vitest, Markdown docs.

---

## File Structure

- Modify `tests/cli/start.test.ts`: add runtime assertions for next-action lines in `status.sh` and inherited `review.sh` output.
- Modify `src/cli/commands/start.ts`: add a status-to-next-action map inside the generated Node script.
- Modify `README.md`: document that `status.sh` prints the next action.
- Modify `CHANGELOG.md`: add the unreleased entry.

## Task 1: Red Tests

- [ ] **Step 1: Add failing status script assertions**

In `tests/cli/start.test.ts`, inside `start writes a Mission Control bundle when requested`, extend the status script content assertions:

```ts
expect(statusScript).toContain('Next action:');
expect(statusScript).toContain('run ./mission.sh to generate proof.');
expect(statusScript).toContain('run ./review.sh and choose a reviewer reply.');
expect(statusScript).toContain('inspect the failed log, fix the issue, then rerun ./mission.sh.');
```

- [ ] **Step 2: Add failing runtime assertions**

In the same test, extend existing status and review runtime checks:

```ts
expect(initialReview.stdout).toContain('Next action: run ./mission.sh to generate proof.');
expect(initialStatus.stdout).toContain('Next action: run ./mission.sh to generate proof.');
expect(passedStatus.stdout).toContain('Next action: run ./review.sh and choose a reviewer reply.');
expect(failedStatus.stdout).toContain('Next action: inspect the failed log, fix the issue, then rerun ./mission.sh.');
```

- [ ] **Step 3: Run focused test and verify red**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because generated `status.sh` does not print `Next action:` yet.

## Task 2: Status Script Generation

- [ ] **Step 1: Add next-action map**

In `src/cli/commands/start.ts`, inside `buildMissionStatusScript()` after optional log output and before `process.exitCode`, add:

```ts
'const nextActions = {',
'  not_run: "run ./mission.sh to generate proof.",',
'  running: "wait for ./mission.sh to finish, or inspect proof-logs/status.jsonl.",',
'  failed: "inspect the failed log, fix the issue, then rerun ./mission.sh.",',
'  passed: "run ./review.sh and choose a reviewer reply.",',
'};',
'const nextAction = nextActions[status] ?? "inspect proof-logs/summary.json.";',
'console.log(`Next action: ${nextAction}`);',
```

- [ ] **Step 2: Run focused test and verify green**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: focused start tests pass.

## Task 3: Docs

- [ ] **Step 1: Update README**

In `README.md`, update the saved bundle paragraph so the `status.sh` sentence says:

```md
Run `./status.sh` from the bundle to print the latest mission state and next action; it exits `0` for passed, `1` for failed, and `2` for not-run or running states.
```

- [ ] **Step 2: Update changelog**

In `CHANGELOG.md`, add:

```md
- Added next-action guidance to saved mission bundle `status.sh` output so not-run, running, failed, and passed states point to the next command.
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

- [ ] **Step 3: Direct status smoke**

Run:

```bash
tmpdir=$(mktemp -d)
node dist/cli/index.js start --intent 'what breaks if I rename the auth token loader' --save-mission "$tmpdir/mission" --quiet >/tmp/projscan-status-next-action-smoke.out
set +e
status_output=$("$tmpdir/mission/status.sh" 2>&1)
status_code=$?
review_output=$("$tmpdir/mission/review.sh" 2>&1)
review_code=$?
set -e
printf '%s\n' "$status_output"
test "$status_code" -eq 2
printf '%s\n' "$status_output" | grep -q 'Next action: run ./mission.sh to generate proof.'
test "$review_code" -eq 2
printf '%s\n' "$review_output" | grep -q 'Next action: run ./mission.sh to generate proof.'
rm -rf "$tmpdir"
rm -f /tmp/projscan-status-next-action-smoke.out
```

Expected: both generated scripts exit `2` in the initial `not_run` state and print the next action.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md CHANGELOG.md
git commit -m "feat: add mission status next actions"
```

Expected: commit succeeds. Do not release, publish, deploy, push, merge, or bump the version.

## Self-Review

- The plan covers every design requirement.
- The tests verify status script content, direct runtime output, and inherited review output.
- The implementation keeps exit codes and summary JSON stable.
- The verification plan includes focused tests, full tests, docs screenshots, packed install smoke, and direct script smoke.
