# Start Next Command Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `projscan start --next-command` shortcut that prints only the current runnable Mission Control cursor command in console mode.

**Architecture:** Keep the Mission Control model unchanged. Add a CLI-only branch in `src/cli/commands/start.ts` that reads `report.missionControl.executionPlan.cursor.command` after report computation and before full console rendering.

**Tech Stack:** TypeScript, Commander, Vitest CLI tests.

---

### Task 1: Add Failing CLI Coverage

**Files:**

- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add command-only console test**

Add a test that runs:

```ts
const result = await runCli([
  'start',
  '--intent',
  'what breaks if I rename the auth token loader',
  '--next-command',
  '--quiet',
]);
```

Assert:

```ts
expect(result.exitCode).toBe(0);
expect(result.stdout).toBe('projscan search "auth token loader" --format json\n');
expect(result.stderr).toBe('');
expect(result.stdout).not.toContain('Start:');
expect(result.stdout).not.toContain('Mission Control');
expect(result.stdout).not.toContain('Run Cursor');
expect(result.stdout).not.toContain('Handoff Prompt');
```

- [ ] **Step 2: Add JSON compatibility test**

Add a test that runs:

```ts
const result = await runCli([
  'start',
  '--intent',
  'what breaks if I rename the auth token loader',
  '--next-command',
  '--format',
  'json',
  '--quiet',
]);
```

Parse stdout and assert:

```ts
expect(report.missionControl.executionPlan.cursor.command).toBe(
  'projscan search "auth token loader" --format json',
);
expect(report.missionControl.runbook.markdown).toContain('## Current Cursor');
```

- [ ] **Step 3: Verify red**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: Commander rejects unknown option `--next-command`.

### Task 2: Implement CLI Shortcut

**Files:**

- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Register the option**

Add:

```ts
.option('--next-command', 'print only the current Mission Control cursor command')
```

near `--handoff-prompt`.

- [ ] **Step 2: Add the console branch**

After the JSON branch and before `--handoff-prompt`, add:

```ts
if (cmdOpts.nextCommand === true) {
  const command = report.missionControl.executionPlan.cursor.command;
  if (!command) {
    console.error(chalk.red('No runnable Mission Control cursor command is available.'));
    process.exit(1);
  }
  console.log(command);
  return;
}
```

- [ ] **Step 3: Verify green**

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

Mention `projscan start --next-command --intent "<goal>"` next to the existing Mission Control shortcut docs and options table.

- [ ] **Step 2: Run verification**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm run lint
git diff --check
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --next-command --quiet
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

- [ ] **Step 3: Commit locally**

Commit with:

```bash
git commit -m "feat: add start next command shortcut"
```
