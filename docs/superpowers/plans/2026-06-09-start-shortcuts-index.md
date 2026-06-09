# Start Shortcuts Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `projscan start --shortcuts` as a compact console menu for the current Mission Control shortcut surface.

**Architecture:** Keep core Mission Control data unchanged. Add a CLI-only branch in `src/cli/commands/start.ts` that reuses the existing current command, MCP tool-call, and proof helpers, then renders shell-safe `projscan start` shortcut commands from the parsed CLI options.

**Tech Stack:** TypeScript, Commander, Vitest, README Markdown, existing Playwright screenshot script.

---

## File Structure

- Modify `tests/cli/start.test.ts`: add red tests for `--shortcuts`, JSON behavior, and shortcut precedence.
- Modify `src/cli/commands/start.ts`: add the Commander option, shortcut rendering helpers, shell-safe quoting, and the console branch.
- Modify `README.md`: document the discovery shortcut in the unreleased Mission Execution Plan section and options table.
- Modify `docs/demos/projscan-4-1-demo.html`: add the shortcut index command to the screenshot source.
- Regenerate `docs/projscan-mission-control.png` and `docs/projscan-proof-router.png` with `npm run docs:screenshots`.

### Task 1: Add CLI Tests

- [ ] **Step 1: Write the failing shortcut index test**

Add near the other focused start shortcut tests in `tests/cli/start.test.ts`:

```ts
test('start prints a shortcut index for the current mission when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--shortcuts',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('Mission Shortcuts');
  expect(result.stdout).toContain('Current command:');
  expect(result.stdout).toContain('projscan search "auth token loader" --format json');
  expect(result.stdout).toContain('Current MCP tool call:');
  expect(result.stdout).toContain('{"tool":"projscan_search","args":{"query":"auth token loader"}}');
  expect(result.stdout).toContain("projscan start --next-command --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --next-tool-call --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --proof-commands --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --checklist --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --runbook --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --handoff-prompt --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).toContain("projscan start --intent 'what breaks if I rename the auth token loader'");
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Run Cursor');
  expect(result.stdout).not.toContain('Ready Proof');
});
```

- [ ] **Step 2: Write the failing JSON behavior test**

Add:

```ts
test('start JSON keeps the full report when shortcuts index is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--shortcuts',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.executionPlan.cursor.command).toBe('projscan search "auth token loader" --format json');
  expect(report.missionControl.resume.toolCall).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
});
```

- [ ] **Step 3: Write the failing precedence test**

Add:

```ts
test('start uses narrower shortcut output before the shortcut index', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--proof-commands',
    '--shortcuts',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const proofCommands = result.stdout.trim().split('\n');
  expect(proofCommands).toContain('projscan preflight --mode before_edit --format json');
  expect(proofCommands).not.toContain('Mission Shortcuts');
  expect(proofCommands).not.toContain('projscan search "auth token loader" --format json');
});
```

- [ ] **Step 4: Run tests and verify they fail for the missing option**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "shortcut index|narrower shortcut" --test-timeout 60000 --hook-timeout 60000
```

Expected: FAIL because Commander rejects unknown option `--shortcuts`.

### Task 2: Implement CLI Shortcut Index

- [ ] **Step 1: Add Commander option**

In `src/cli/commands/start.ts`, add near the other shortcut flags:

```ts
.option('--shortcuts', 'print the Mission Control shortcut command index')
```

- [ ] **Step 2: Add the console branch**

After the `--runbook` branch and before `--handoff-prompt`, add:

```ts
if (cmdOpts.shortcuts === true) {
  printShortcutsOnly(report, {
    intent: typeof cmdOpts.intent === 'string' ? cmdOpts.intent : undefined,
    mode,
  });
  return;
}
```

This placement lets narrower shortcut outputs keep precedence.

- [ ] **Step 3: Add rendering helpers**

Add below `printRunbookOnly`:

```ts
interface StartShortcutCommandOptions {
  intent?: string;
  mode?: WorkplanMode;
}

function printShortcutsOnly(report: StartReport, options: StartShortcutCommandOptions): void {
  const command = report.missionControl.executionPlan.cursor.command;
  const toolCall = nextToolCall(report);
  const shortcuts = [
    shortcutCommand('--next-command', options),
    shortcutCommand('--next-tool-call', options),
    shortcutCommand('--proof-commands', options),
    shortcutCommand('--checklist', options),
    shortcutCommand('--runbook', options),
    shortcutCommand('--handoff-prompt', options),
    startBaseCommand(options),
  ];

  console.log(chalk.bold('Mission Shortcuts'));
  if (command) {
    console.log('Current command:');
    console.log(command);
    console.log('');
  }
  if (toolCall) {
    console.log('Current MCP tool call:');
    console.log(JSON.stringify(toolCall));
    console.log('');
  }
  console.log('Copy from here:');
  for (const shortcut of shortcuts) console.log(shortcut);
}

function shortcutCommand(flag: string, options: StartShortcutCommandOptions): string {
  return `${startBaseCommand(options)} ${flag}`;
}

function startBaseCommand(options: StartShortcutCommandOptions): string {
  const args = ['projscan start'];
  if (options.mode) args.push('--mode', shellQuote(options.mode));
  if (options.intent) args.push('--intent', shellQuote(options.intent));
  return args.join(' ');
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "shortcut index|narrower shortcut" --test-timeout 60000 --hook-timeout 60000
```

Expected: PASS for the new tests.

### Task 3: Update Docs And Screenshots

- [ ] **Step 1: Update README copy**

In `README.md`, add `projscan start --shortcuts --intent "<goal>"` before the focused shortcuts block and add `--shortcuts` to the options table.

- [ ] **Step 2: Stop-slop review**

Read the edited README paragraphs and remove filler. Keep the copy direct: name the problem, show the command, and avoid promotional phrasing.

- [ ] **Step 3: Update demo HTML**

In `docs/demos/projscan-4-1-demo.html`, add `projscan start --shortcuts --intent "..."` to the “Copyable Shortcuts” terminal block.

- [ ] **Step 4: Regenerate screenshots**

Run:

```bash
npm run docs:screenshots
```

Expected: the command exits 0 and updates the existing docs PNGs.

- [ ] **Step 5: Visual inspection**

Open `docs/projscan-mission-control.png` and `docs/projscan-proof-router.png`. Confirm the new text fits and no terminal labels overlap.

### Task 4: Verify And Commit

- [ ] **Step 1: Run build**

Run:

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 2: Run focused start tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: exit 0.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 4: Run live shortcut command**

Run:

```bash
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --shortcuts --quiet
```

Expected: output starts with `Mission Shortcuts` and includes `projscan start --next-tool-call --intent 'what breaks if I rename the auth token loader'`.

- [ ] **Step 5: Run repository gates**

Run:

```bash
git diff --check
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

Expected: all commands exit 0. Existing non-fatal plugin trust or remote-rate warnings can appear if the command still exits 0.

- [ ] **Step 6: Commit implementation**

Run:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/demos/projscan-4-1-demo.html docs/projscan-mission-control.png docs/projscan-proof-router.png
git commit -m "feat: add start shortcuts index"
```

## Self-Review

- The plan covers the CLI behavior, docs, screenshots, and verification from the design.
- The plan keeps JSON and MCP stable.
- No placeholder steps remain.
- The implementation code in the plan uses exact function names and existing helper patterns.
