# Start Next Tool Call Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `projscan start --next-tool-call` shortcut that prints only the current Mission Control cursor MCP tool call as compact JSON in console mode.

**Architecture:** Keep Mission Control data unchanged. Add a CLI-only branch in `src/cli/commands/start.ts` that reuses `missionControl.resume.toolCall`, falling back to the execution cursor's `tool` / `args` fields when needed.

**Tech Stack:** TypeScript, Commander, Vitest CLI tests.

---

### Task 1: Add Failing CLI Coverage

**Files:**
- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add next-tool-call console test**

Add a test near the existing `--next-command` tests:

```ts
test('start prints only the current cursor MCP tool call when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--next-tool-call',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe('{"tool":"projscan_search","args":{"query":"auth token loader"}}\n');
  expect(result.stderr).toBe('');
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Run Cursor');
  expect(result.stdout).not.toContain('Handoff Prompt');
});
```

- [ ] **Step 2: Add JSON compatibility test**

Add:

```ts
test('start JSON keeps the full report when next-tool-call shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--next-tool-call',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.resume.toolCall).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
  expect(report.missionControl.executionPlan.cursor.tool).toBe('projscan_search');
});
```

- [ ] **Step 3: Verify red**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: Commander rejects unknown option `--next-tool-call`, causing the two new tests to fail on exit code.

### Task 2: Implement CLI Shortcut

**Files:**
- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Register the option**

Add:

```ts
.option('--next-tool-call', 'print only the current Mission Control cursor MCP tool call as JSON')
```

near `--next-command`.

- [ ] **Step 2: Add tool-call selection helper**

Create:

```ts
function nextToolCall(report: StartReport): StartMissionToolCall | undefined {
  const resumeToolCall = report.missionControl.resume.toolCall;
  if (resumeToolCall) return resumeToolCall;
  const cursor = report.missionControl.executionPlan.cursor;
  if (!cursor.tool) return undefined;
  return {
    tool: cursor.tool,
    ...(typeof cursor.args !== 'undefined' ? { args: cursor.args } : {}),
  };
}
```

- [ ] **Step 3: Add the console branch**

After the `--next-command` branch and before `--proof-commands`, add:

```ts
if (cmdOpts.nextToolCall === true) {
  const toolCall = nextToolCall(report);
  if (!toolCall) {
    console.error(chalk.red('No MCP-callable Mission Control cursor tool call is available.'));
    process.exit(1);
  }
  console.log(JSON.stringify(toolCall));
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

Mention `projscan start --next-tool-call --intent "<goal>"` next to the existing Mission Control shortcut docs and options table.

- [ ] **Step 2: Run verification**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm run lint
git diff --check
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --next-tool-call --quiet
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

- [ ] **Step 3: Commit locally**

Commit with:

```bash
git commit -m "feat: add start next tool call shortcut"
```
