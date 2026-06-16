# Mission Summary Next Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add machine-readable next-action guidance to saved mission bundle `proof-logs/summary.json`.

**Architecture:** Keep the existing flat summary JSON contract and add one `nextAction` string. Reuse the same state-to-action text for initial summaries, generated `mission.sh` summaries, and `status.sh` fallback output.

**Tech Stack:** TypeScript, Node shell script generation, Vitest, Markdown docs.

---

## File Structure

- Modify `tests/cli/start.test.ts`: assert initial `summary.json`, generated `mission.sh` content, and `status.sh` output with a custom summary action.
- Modify `src/cli/commands/start.ts`: add a shared next-action map and write `nextAction` to summary JSON.
- Modify `README.md`: document that `summary.json` carries next-action guidance for agents.
- Modify `CHANGELOG.md`: add an unreleased entry.

## Task 1: Red Tests

- [ ] **Step 1: Add initial summary assertion**

In `tests/cli/start.test.ts`, update the `proofSummary` assertion inside `start writes a Mission Control bundle when requested` to:

```ts
expect(proofSummary).toEqual({
  schemaVersion: 1,
  status: 'not_run',
  nextAction: 'run ./mission.sh to generate proof.',
  report: 'proof-logs/run-report.md',
  statusRows: 'proof-logs/status.jsonl',
});
```

- [ ] **Step 2: Add generated mission script assertions**

In the same test, near the existing mission script summary assertions, add:

```ts
expect(missionScript).toContain(
  '"nextAction":"wait for ./mission.sh to finish, or inspect proof-logs/status.jsonl."',
);
expect(missionScript).toContain('"nextAction":"run ./review.sh and choose a reviewer reply."');
expect(missionScript).toContain(
  '"nextAction":"inspect the failed log, fix the issue, then rerun ./mission.sh."',
);
```

- [ ] **Step 3: Prove status.sh prefers summary.nextAction**

In the manual passed summary object, add:

```ts
nextAction: 'open review mode now.',
```

Then change the passed status assertion to:

```ts
expect(passedStatus.stdout).toContain('Next action: open review mode now.');
```

- [ ] **Step 4: Run the focused test and verify red**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because generated summaries do not write `nextAction` and `status.sh` ignores custom `summary.nextAction`.

## Task 2: Implementation

- [ ] **Step 1: Add shared next-action text**

In `src/cli/commands/start.ts`, near the mission summary helpers, add:

```ts
const missionRunNextActions = {
  not_run: 'run ./mission.sh to generate proof.',
  running: 'wait for ./mission.sh to finish, or inspect proof-logs/status.jsonl.',
  failed: 'inspect the failed log, fix the issue, then rerun ./mission.sh.',
  passed: 'run ./review.sh and choose a reviewer reply.',
} as const;
```

- [ ] **Step 2: Prefer summary.nextAction in status.sh**

In `buildMissionStatusScript()`, replace the current `nextActions` and `nextAction` generated lines with:

```ts
`const nextActions = ${JSON.stringify(missionRunNextActions)};`,
'const nextAction = typeof summary.nextAction === "string" ? summary.nextAction : nextActions[status] ?? "inspect proof-logs/summary.json.";',
```

- [ ] **Step 3: Add nextAction to initial summary**

In `missionInitialRunSummary()`, add:

```ts
nextAction: missionRunNextActions.not_run,
```

- [ ] **Step 4: Add nextAction to run summaries**

In `scriptWriteSummaryJson()`, add this field to `base`:

```ts
nextAction: missionRunNextActions[status],
```

- [ ] **Step 5: Run the focused test and verify green**

Run:

```bash
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: focused start tests pass.

## Task 3: Docs

- [ ] **Step 1: Update README**

In `README.md`, update the saved mission bundle paragraph so it says:

```md
Running saved `mission.sh` writes current and proof command output under `proof-logs/`, appends exit codes to `status.jsonl`, refreshes `run-report.md` for review, and writes the latest run state plus next action to `summary.json` for agents.
```

- [ ] **Step 2: Update changelog**

In `CHANGELOG.md`, add:

```md
- Added `nextAction` to saved mission bundle `proof-logs/summary.json` so agents can read the next command without parsing `status.sh` output.
```

- [ ] **Step 3: Run docs screenshot generation**

Run:

```bash
npm run docs:screenshots
```

Expected: command exits `0`. Generated screenshots may remain unchanged.

## Task 4: Verification and Commit

- [ ] **Step 1: Build and focused test**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: both commands exit `0`.

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

Expected: all commands exit `0`.

- [ ] **Step 3: Direct summary smoke**

Run:

```bash
tmpdir=$(mktemp -d)
node dist/cli/index.js start --intent 'what breaks if I rename the auth token loader' --save-mission "$tmpdir/mission" --quiet >/tmp/projscan-summary-next-action-smoke.out
node -e 'const fs=require("node:fs"); const summary=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if (summary.nextAction !== "run ./mission.sh to generate proof.") process.exit(1);' "$tmpdir/mission/proof-logs/summary.json"
"$tmpdir/mission/status.sh" | grep -q 'Next action: run ./mission.sh to generate proof.'
rm -rf "$tmpdir"
rm -f /tmp/projscan-summary-next-action-smoke.out
```

Expected: saved `summary.json` and generated `status.sh` agree on the initial next action.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md CHANGELOG.md
git commit -m "feat: add mission summary next action"
```

Expected: commit succeeds. Do not release, publish, deploy, push, merge, or bump the version.

## Plan Review

- The tasks cover every requirement in `docs/superpowers/specs/2026-06-09-mission-summary-next-action-design.md`.
- No placeholder steps remain.
- The field name is consistently `nextAction`.
- The plan preserves existing status exit codes and older-bundle fallback behavior.
