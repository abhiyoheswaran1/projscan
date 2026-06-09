# Start Ready Tool Calls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `projscan start --ready-tool-calls`, a compact JSON array of currently runnable MCP tool calls for the active Mission Control intent.

**Architecture:** Reuse the existing CLI-only shortcut pattern in `src/cli/commands/start.ts`. Build the queue from `nextToolCall(report)` plus `report.missionControl.handoff.readyProof.toolCalls`, then compact each item to `{ tool, args? }` before printing.

**Tech Stack:** TypeScript, Commander, Vitest, Markdown docs, existing Playwright screenshot script.

---

## File Structure

- Modify `tests/cli/start.test.ts`: add red tests for `--ready-tool-calls`, JSON behavior, and the shortcut index line.
- Modify `src/cli/commands/start.ts`: add the Commander option, queue helper, compacting helper, and console branch.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document the new shortcut.
- Modify `docs/demos/projscan-4-1-demo.html`: show the ready tool-call queue in the screenshot source.
- Regenerate `docs/projscan-mission-control.png` and `docs/projscan-proof-router.png`.

### Task 1: Add CLI Tests

- [ ] **Step 1: Add ready-tool-calls shortcut test**

Add near the existing tool-call shortcut tests in `tests/cli/start.test.ts`:

```ts
test('start prints every ready MCP tool call when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--ready-tool-calls',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  const calls = JSON.parse(result.stdout);
  expect(calls[0]).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
  expect(calls).toContainEqual({
    tool: 'projscan_preflight',
    args: { mode: 'before_edit' },
  });
  expect(calls).toContainEqual({
    tool: 'projscan_understand',
    args: { view: 'verify' },
  });
  expect(calls.some((call: Record<string, unknown>) => 'stepId' in call || 'command' in call)).toBe(false);
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
});
```

- [ ] **Step 2: Add JSON behavior test**

Add:

```ts
test('start JSON keeps the full report when ready tool calls are requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--ready-tool-calls',
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
  expect(report.missionControl.handoff.readyProof.toolCalls).toEqual(report.missionControl.resume.remainingProofToolCalls);
});
```

- [ ] **Step 3: Extend shortcut index test**

Add this assertion to `start prints a shortcut index for the current mission when requested`:

```ts
expect(result.stdout).toContain("projscan start --ready-tool-calls --intent 'what breaks if I rename the auth token loader'");
```

- [ ] **Step 4: Run red tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "ready MCP tool call|ready tool calls|shortcut index" --test-timeout 60000 --hook-timeout 60000
```

Expected: FAIL because Commander rejects unknown option `--ready-tool-calls`.

### Task 2: Implement CLI Output

- [ ] **Step 1: Add Commander option**

In `src/cli/commands/start.ts`, add near `--next-tool-call`:

```ts
.option('--ready-tool-calls', 'print all currently ready Mission Control MCP tool calls as compact JSON')
```

- [ ] **Step 2: Add console branch**

After the `--next-tool-call` branch and before `--proof-commands`, add:

```ts
if (cmdOpts.readyToolCalls === true) {
  const toolCalls = readyToolCalls(report);
  if (toolCalls.length === 0) {
    console.error(chalk.red('No ready Mission Control MCP tool calls are available.'));
    process.exit(1);
  }
  console.log(JSON.stringify(toolCalls));
  return;
}
```

- [ ] **Step 3: Add queue helpers**

Add below `nextToolCall`:

```ts
function readyToolCalls(report: StartReport): StartMissionToolCall[] {
  const calls: StartMissionToolCall[] = [];
  const current = nextToolCall(report);
  if (current) calls.push(compactToolCall(current));
  for (const proofCall of report.missionControl.handoff.readyProof.toolCalls ?? []) {
    calls.push(compactToolCall(proofCall));
  }
  return dedupeToolCalls(calls);
}

function compactToolCall(toolCall: StartMissionToolCall): StartMissionToolCall {
  return {
    tool: toolCall.tool,
    ...(typeof toolCall.args !== 'undefined' ? { args: toolCall.args } : {}),
  };
}

function dedupeToolCalls(toolCalls: StartMissionToolCall[]): StartMissionToolCall[] {
  const seen = new Set<string>();
  const out: StartMissionToolCall[] = [];
  for (const toolCall of toolCalls) {
    const key = JSON.stringify(toolCall);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toolCall);
  }
  return out;
}
```

- [ ] **Step 4: Add to shortcut index**

In `printShortcutsOnly`, insert:

```ts
shortcutCommand('--ready-tool-calls', options),
```

after `--next-tool-call`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "ready MCP tool call|ready tool calls|shortcut index" --test-timeout 60000 --hook-timeout 60000
```

Expected: PASS.

### Task 3: Update Docs And Screenshots

- [ ] **Step 1: Update docs**

Add `projscan start --ready-tool-calls --intent "<goal>"` to the README shortcut list and options table. Add a short guide sentence and an Unreleased changelog bullet.

- [ ] **Step 2: Update demo HTML**

Add `projscan start --ready-tool-calls --intent "..."` to the “Copyable Shortcuts” terminal block in `docs/demos/projscan-4-1-demo.html`.

- [ ] **Step 3: Regenerate and inspect screenshots**

Run:

```bash
npm run docs:screenshots
```

Then inspect `docs/projscan-mission-control.png` and `docs/projscan-proof-router.png` for text clipping or overlap.

### Task 4: Verify And Commit

- [ ] **Step 1: Run verification**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm run lint
git diff --check
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --ready-tool-calls --quiet
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
git commit -m "feat: add start ready tool calls shortcut"
```

## Self-Review

- The plan covers behavior, docs, screenshots, and verification.
- The output stays CLI-only and compact.
- No placeholders remain.
- The test names match the command pattern used for red and green runs.
