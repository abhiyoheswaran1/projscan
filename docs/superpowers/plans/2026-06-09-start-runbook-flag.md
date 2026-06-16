# Start Runbook Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `projscan start --runbook` shortcut that prints only the Mission Control Markdown runbook in console mode.

**Architecture:** Keep Mission Control data unchanged. Add a CLI-only branch in `src/cli/commands/start.ts` that prints the existing `missionControl.runbook.markdown` string without the default console report wrapper.

**Tech Stack:** TypeScript, Commander, Vitest CLI tests.

---

### Task 1: Add Failing CLI Coverage

**Files:**

- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add runbook-only console test**

Add a test near the existing start shortcut tests:

```ts
test('start prints only the mission runbook when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--runbook',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout.startsWith('# Mission Runbook\n')).toBe(true);
  expect(result.stdout).toContain('## Current Cursor');
  expect(result.stdout).toContain('## Resume');
  expect(result.stdout).toContain('## Handoff Prompt');
  expect(result.stdout).toContain('## Ready Commands');
  expect(result.stdout).toContain('## Proof Commands');
  expect(result.stdout).toContain('Resume checklist:');
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Agent Runbook');
  expect(result.stdout).not.toContain('First 10 Minutes');
});
```

- [ ] **Step 2: Add JSON compatibility test**

Add:

```ts
test('start JSON keeps the full report when runbook shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--runbook',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.runbook.markdown).toContain('# Mission Runbook');
  expect(report.missionControl.runbook.markdown).toContain('## Handoff Prompt');
});
```

- [ ] **Step 3: Verify red**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: Commander rejects unknown option `--runbook`, causing the two new tests to fail on exit code.

### Task 2: Implement CLI Shortcut

**Files:**

- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Register the option**

Add:

```ts
.option('--runbook', 'print only the Mission Control Markdown runbook')
```

near the other start shortcuts.

- [ ] **Step 2: Add runbook output helper**

Create:

```ts
function printRunbookOnly(report: StartReport): void {
  const runbook = report.missionControl.runbook.markdown.trimEnd();
  if (runbook.length === 0) {
    console.error(chalk.red('No Mission Control runbook is available.'));
    process.exit(1);
  }
  console.log(runbook);
}
```

- [ ] **Step 3: Add the console branch**

After the `--checklist` branch and before `--handoff-prompt`, add:

```ts
if (cmdOpts.runbook === true) {
  printRunbookOnly(report);
  return;
}
```

- [ ] **Step 4: Verify green**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: all CLI start tests pass.

### Task 3: Update Docs And Verify

**Files:**

- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Document the shortcut**

Mention `projscan start --runbook --intent "<goal>"` next to the existing Mission Control shortcut docs and options table.

- [ ] **Step 2: Run verification**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm run lint
git diff --check
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --runbook --quiet
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

- [ ] **Step 3: Commit locally**

Commit with:

```bash
git commit -m "feat: add start runbook shortcut"
```
