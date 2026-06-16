# Start Resume JSON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `projscan start --resume-json`, a compact JSON shortcut for `missionControl.resume`.

**Architecture:** Keep core Mission Control data unchanged. Add a Commander flag and console-only branch in `src/cli/commands/start.ts` that prints `report.missionControl.resume` as compact JSON before broader runbook/shortcut outputs.

**Tech Stack:** TypeScript, Commander, Vitest, Markdown docs, existing Playwright screenshot script.

---

## File Structure

- Modify `tests/cli/start.test.ts`: add red tests for `--resume-json`, JSON behavior, and shortcut index coverage.
- Modify `src/cli/commands/start.ts`: add the option and branch.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document the shortcut.
- Modify `docs/demos/projscan-4-1-demo.html`: add the shortcut to the demo terminal block.
- Regenerate `docs/projscan-mission-control.png`; `docs/projscan-proof-router.png` may remain byte-identical if the proof section does not change.

### Task 1: Add CLI Tests

- [ ] **Step 1: Add resume-json shortcut test**

Add near the existing checklist and runbook shortcut tests in `tests/cli/start.test.ts`:

```ts
test('start prints only the resume object as compact JSON when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--resume-json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  const resume = JSON.parse(result.stdout);
  expect(resume.currentStep.stepId).toBe('ready-1');
  expect(resume.toolCall).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
  expect(resume.inputBindings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        placeholder: '<symbol-from-search>',
        inputId: 'input-1',
      }),
    ]),
  );
  expect(resume.checklist[0].kind).toBe('run_current');
  expect(resume.remainingProofToolCalls).toContainEqual({
    stepId: 'proof-2',
    command: 'projscan preflight --mode before_edit --format json',
    tool: 'projscan_preflight',
    args: { mode: 'before_edit' },
  });
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Resume Checklist');
});
```

- [ ] **Step 2: Add JSON behavior test**

Add:

```ts
test('start JSON keeps the full report when resume-json shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--resume-json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.resume.currentStep.stepId).toBe('ready-1');
  expect(report.missionControl.runbook.resume).toEqual(report.missionControl.resume);
});
```

- [ ] **Step 3: Extend shortcut index test**

Add this assertion to `start prints a shortcut index for the current mission when requested`:

```ts
expect(result.stdout).toContain(
  "projscan start --resume-json --intent 'what breaks if I rename the auth token loader'",
);
```

- [ ] **Step 4: Run red tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "resume object|resume-json|shortcut index" --test-timeout 60000 --hook-timeout 60000
```

Expected: FAIL because Commander rejects unknown option `--resume-json`, and the shortcut index omits it.

### Task 2: Implement CLI Shortcut

- [ ] **Step 1: Add Commander option**

In `src/cli/commands/start.ts`, add near `--checklist`:

```ts
.option('--resume-json', 'print only the Mission Control resume object as compact JSON')
```

- [ ] **Step 2: Add console branch**

After the `--checklist` branch and before `--runbook`, add:

```ts
if (cmdOpts.resumeJson === true) {
  console.log(JSON.stringify(report.missionControl.resume));
  return;
}
```

- [ ] **Step 3: Add to shortcut index**

In `printShortcutsOnly`, insert:

```ts
shortcutCommand('--resume-json', options),
```

after `--checklist`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "resume object|resume-json|shortcut index" --test-timeout 60000 --hook-timeout 60000
```

Expected: PASS.

### Task 3: Update Docs And Screenshots

- [ ] **Step 1: Update docs**

Add `projscan start --resume-json --intent "<goal>"` to the README shortcut list and options table. Add a guide sentence and changelog bullet.

- [ ] **Step 2: Update demo HTML**

Add `projscan start --resume-json --intent "..."` to the “Copyable Shortcuts” terminal block.

- [ ] **Step 3: Regenerate and inspect screenshots**

Run:

```bash
npm run docs:screenshots
```

Inspect the regenerated PNGs for text clipping or overlap.

### Task 4: Verify And Commit

- [ ] **Step 1: Run verification**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm run lint
git diff --check
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --resume-json --quiet
npm run docs:screenshots
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

Expected: all commands exit 0. Existing non-fatal plugin trust or remote-rate warnings can appear if the command exits 0.

- [ ] **Step 2: Commit**

Run:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md docs/demos/projscan-4-1-demo.html docs/projscan-mission-control.png docs/projscan-proof-router.png
git commit -m "feat: add start resume json shortcut"
```

## Self-Review

- The plan covers the shortcut, docs, screenshots, and verification.
- No placeholder steps remain.
- The implementation prints existing data and does not add a new schema field.
