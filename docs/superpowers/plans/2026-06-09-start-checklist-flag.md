# Start Checklist Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `projscan start --checklist` shortcut that prints only Mission Control resume checklist rows in console mode.

**Architecture:** Keep Mission Control data unchanged. Add a CLI-only branch in `src/cli/commands/start.ts` that reuses the existing `formatConsoleChecklistItem` formatter used by the default console `Resume Checklist` section.

**Tech Stack:** TypeScript, Commander, Vitest CLI tests.

---

### Task 1: Add Failing CLI Coverage

**Files:**

- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add checklist-only console test**

Add a test near the existing start shortcut tests:

```ts
test('start prints only the resume checklist when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--checklist',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const checklistRows = result.stdout.trim().split('\n');
  expect(checklistRows[0]).toBe(
    '- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})',
  );
  expect(checklistRows).toContain(
    '- [blocked] resolve_input input-1: <symbol-from-search> -> Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(checklistRows).toContain(
    '- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})',
  );
  expect(checklistRows).toContain(
    '- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Resume Checklist');
  expect(result.stdout).not.toContain('Handoff Prompt');
});
```

- [ ] **Step 2: Add JSON compatibility test**

Add:

```ts
test('start JSON keeps the full report when checklist shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--checklist',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.resume.checklist).toEqual(
    report.missionControl.handoff.resume.checklist,
  );
  expect(report.missionControl.resume.checklist[0].command).toBe(
    'projscan search "auth token loader" --format json',
  );
});
```

- [ ] **Step 3: Verify red**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: Commander rejects unknown option `--checklist`, causing the two new tests to fail on exit code.

### Task 2: Implement CLI Shortcut

**Files:**

- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Register the option**

Add:

```ts
.option('--checklist', 'print only the Mission Control resume checklist')
```

near the other start shortcuts.

- [ ] **Step 2: Add checklist output helper**

Create:

```ts
function printChecklistOnly(report: StartReport): void {
  const checklist = report.missionControl.resume.checklist ?? [];
  if (checklist.length === 0) {
    console.error(chalk.red('No Mission Control resume checklist is available.'));
    process.exit(1);
  }
  for (const item of checklist) {
    console.log(`- ${formatConsoleChecklistItem(item)}`);
  }
}
```

- [ ] **Step 3: Add the console branch**

After the `--proof-commands` branch and before `--handoff-prompt`, add:

```ts
if (cmdOpts.checklist === true) {
  printChecklistOnly(report);
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

Mention `projscan start --checklist --intent "<goal>"` next to the existing Mission Control shortcut docs and options table.

- [ ] **Step 2: Run verification**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm run lint
git diff --check
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --checklist --quiet
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

- [ ] **Step 3: Commit locally**

Commit with:

```bash
git commit -m "feat: add start checklist shortcut"
```
