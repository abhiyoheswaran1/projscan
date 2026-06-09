# Shortcuts JSON Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a machine-readable `projscan start --shortcuts-json` shortcut and saved `shortcuts.json` mission bundle file backed by the same shortcut index used by `--shortcuts`.

**Architecture:** Move shortcut command construction into a shared `buildShortcutIndex()` helper in `src/cli/commands/start.ts`. Render that index as console text for `--shortcuts`, compact JSON for `--shortcuts-json`, and pretty JSON for saved mission bundles.

**Tech Stack:** TypeScript, Commander CLI, Vitest, Markdown docs, Playwright-backed README screenshot capture.

---

## File Structure

- Modify `src/cli/commands/start.ts`: add `--shortcuts-json`, shortcut index types/helpers, saved bundle file, manifest entry, and console renderer reuse.
- Modify `tests/cli/start.test.ts`: add red tests for `--shortcuts-json`, bundle file, manifest list, JSON bundle mode, and the existing console index.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document the shortcut JSON export and saved bundle file.
- Run `npm run docs:screenshots`; keep generated image changes only if screenshots differ.

## Task 1: Red CLI Tests

**Files:**
- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Assert saved bundles contain `shortcuts.json`**

In `start writes a Mission Control bundle when requested`, add:

```ts
expect(result.stdout).toContain('shortcuts.json');
expect(quickstart).toContain('- `shortcuts.json`: Machine-readable Mission Control shortcut command index.');
```

After the `readyToolCalls` assertions, add:

```ts
const shortcuts = JSON.parse(await fs.readFile(path.join(bundleDir, 'shortcuts.json'), 'utf-8'));
expect(shortcuts).toMatchObject({
  schemaVersion: 1,
  kind: 'projscan.start-shortcuts',
  currentCommand: 'projscan search "auth token loader" --format json',
  currentToolCall: {
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  },
  baseCommand: "projscan start --intent 'what breaks if I rename the auth token loader'",
});
expect(shortcuts.shortcuts.map((entry: { id: string }) => entry.id)).toEqual([
  'next-command',
  'next-tool-call',
  'ready-tool-calls',
  'proof-commands',
  'checklist',
  'resume-json',
  'handoff-json',
  'save-mission',
  'task-card',
  'review-gate',
  'review-gate-json',
  'review-policy',
  'review-replies',
  'runbook',
  'handoff-prompt',
  'start',
]);
expect(shortcuts.shortcuts.find((entry: { id: string }) => entry.id === 'shortcuts-json')).toBeUndefined();
expect(shortcuts.shortcuts.map((entry: { command: string }) => entry.command)).toContain(
  "projscan start --review-gate-json --intent 'what breaks if I rename the auth token loader'",
);
```

Add `shortcuts.json` to the exact manifest file-name order after `ready-tool-calls.json`.

- [ ] **Step 2: Assert JSON bundle mode lists the file**

In `start reports the Mission Control bundle as JSON when save-mission uses JSON format`, add `shortcuts.json` to the `arrayContaining` expectation.

- [ ] **Step 3: Add shortcut JSON test**

Add this test after `start prints a shortcut index for the current mission when requested`:

```ts
test('start prints a shortcut index as compact JSON when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--shortcuts-json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).not.toContain('Mission Shortcuts');
  expect(result.stdout).not.toContain('Start:');
  const shortcuts = JSON.parse(result.stdout);
  expect(result.stdout).toBe(`${JSON.stringify(shortcuts)}\n`);
  expect(shortcuts.schemaVersion).toBe(1);
  expect(shortcuts.kind).toBe('projscan.start-shortcuts');
  expect(shortcuts.currentCommand).toBe('projscan search "auth token loader" --format json');
  expect(shortcuts.currentToolCall).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
  expect(shortcuts.baseCommand).toBe("projscan start --intent 'what breaks if I rename the auth token loader'");
  expect(shortcuts.shortcuts.map((entry: { id: string }) => entry.id)).toEqual([
    'next-command',
    'next-tool-call',
    'ready-tool-calls',
    'proof-commands',
    'checklist',
    'resume-json',
    'handoff-json',
    'save-mission',
    'task-card',
    'review-gate',
    'review-gate-json',
    'review-policy',
    'review-replies',
    'runbook',
    'handoff-prompt',
    'start',
  ]);
  expect(shortcuts.shortcuts[0]).toEqual({
    id: 'next-command',
    label: 'Current shell command',
    command: "projscan start --next-command --intent 'what breaks if I rename the auth token loader'",
    description: 'Print only the current Mission Control cursor command.',
  });
  expect(shortcuts.shortcuts.at(-1)).toEqual({
    id: 'start',
    label: 'Full start report',
    command: "projscan start --intent 'what breaks if I rename the auth token loader'",
    description: 'Print the full Mission Control start report.',
  });
});
```

- [ ] **Step 4: Keep existing JSON-format precedence**

Add this test after the new shortcut JSON test:

```ts
test('start JSON keeps the full report when shortcuts-json index is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--shortcuts-json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.executionPlan.cursor.command).toBe('projscan search "auth token loader" --format json');
  expect(report.missionControl.reviewGate.policy).toEqual(expectedReviewPolicy);
  expect(report.kind).not.toBe('projscan.start-shortcuts');
});
```

- [ ] **Step 5: Run red tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission uses JSON format|shortcut index|shortcuts-json" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `--shortcuts-json` and `shortcuts.json` do not exist yet.

## Task 2: CLI And Bundle Implementation

**Files:**
- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Add Commander option**

After `--shortcuts`, add:

```ts
.option('--shortcuts-json', 'print the Mission Control shortcut command index as JSON')
```

- [ ] **Step 2: Add shortcut index types**

After `interface StartShortcutCommandOptions`, add:

```ts
interface StartShortcutEntry {
  id: string;
  label: string;
  command: string;
  description: string;
}

interface StartShortcutIndex {
  schemaVersion: 1;
  kind: 'projscan.start-shortcuts';
  currentCommand?: string;
  currentToolCall?: StartMissionToolCall;
  baseCommand: string;
  shortcuts: StartShortcutEntry[];
}
```

- [ ] **Step 3: Add shared shortcut index builder**

Replace the local `shortcuts` array in `printShortcutsOnly()` with a helper:

```ts
function buildShortcutIndex(report: StartReport, options: StartShortcutCommandOptions): StartShortcutIndex {
  const command = report.missionControl.executionPlan.cursor.command;
  const toolCall = nextToolCall(report);
  const entries: StartShortcutEntry[] = [
    shortcutEntry('next-command', 'Current shell command', '--next-command', 'Print only the current Mission Control cursor command.', options),
    shortcutEntry('next-tool-call', 'Current MCP tool call', '--next-tool-call', 'Print only the current Mission Control cursor MCP tool call as compact JSON.', options),
    shortcutEntry('ready-tool-calls', 'Ready MCP calls', '--ready-tool-calls', 'Print the current cursor and remaining MCP-callable proof queue as compact JSON.', options),
    shortcutEntry('proof-commands', 'Ready proof commands', '--proof-commands', 'Print only ready Mission Control proof commands.', options),
    shortcutEntry('checklist', 'Resume checklist', '--checklist', 'Print only the Mission Control resume checklist.', options),
    shortcutEntry('resume-json', 'Resume JSON', '--resume-json', 'Print only the structured Mission Control resume object.', options),
    shortcutEntry('handoff-json', 'Handoff JSON', '--handoff-json', 'Print only the structured Mission Control handoff object.', options),
    shortcutEntry('save-mission', 'Save mission bundle', '--save-mission .projscan/mission', 'Write the Mission Control bundle to .projscan/mission.', options),
    shortcutEntry('task-card', 'Task card', '--task-card', 'Print only the Mission Control Markdown task card.', options),
    shortcutEntry('review-gate', 'Review gate Markdown', '--review-gate', 'Print only the Mission Control stop-and-review gate.', options),
    shortcutEntry('review-gate-json', 'Review gate JSON', '--review-gate-json', 'Print only the Mission Control review gate as JSON.', options),
    shortcutEntry('review-policy', 'Review policy JSON', '--review-policy', 'Print only the Mission Control review policy as JSON.', options),
    shortcutEntry('review-replies', 'Reviewer replies', '--review-replies', 'Print only copyable Mission Control reviewer replies.', options),
    shortcutEntry('runbook', 'Mission runbook', '--runbook', 'Print only the Mission Control Markdown runbook.', options),
    shortcutEntry('handoff-prompt', 'Handoff prompt', '--handoff-prompt', 'Print only the concise Mission Control handoff prompt.', options),
    {
      id: 'start',
      label: 'Full start report',
      command: startBaseCommand(options),
      description: 'Print the full Mission Control start report.',
    },
  ];

  return {
    schemaVersion: 1,
    kind: 'projscan.start-shortcuts',
    ...(command ? { currentCommand: command } : {}),
    ...(toolCall ? { currentToolCall: toolCall } : {}),
    baseCommand: startBaseCommand(options),
    shortcuts: entries,
  };
}

function shortcutEntry(
  id: string,
  label: string,
  flag: string,
  description: string,
  options: StartShortcutCommandOptions,
): StartShortcutEntry {
  return {
    id,
    label,
    command: shortcutCommand(flag, options),
    description,
  };
}
```

- [ ] **Step 4: Reuse the index in console output**

Update `printShortcutsOnly()` to use:

```ts
const shortcutIndex = buildShortcutIndex(report, options);
```

Use `shortcutIndex.currentCommand`, `shortcutIndex.currentToolCall`, and `shortcutIndex.shortcuts.map((entry) => entry.command)` for console output.

- [ ] **Step 5: Add shortcut JSON handler**

After the `cmdOpts.shortcuts` branch, add:

```ts
if (cmdOpts.shortcutsJson === true) {
  printShortcutsJsonOnly(report, {
    intent: typeof cmdOpts.intent === 'string' ? cmdOpts.intent : undefined,
    mode,
  });
  return;
}
```

Add:

```ts
function printShortcutsJsonOnly(report: StartReport, options: StartShortcutCommandOptions): void {
  console.log(JSON.stringify(buildShortcutIndex(report, options)));
}
```

- [ ] **Step 6: Write `shortcuts.json` in saved bundles**

In `writeMissionBundle()`, define shortcut options with a helper so saved bundles preserve intent-inferred starts:

```ts
const shortcutOptions = missionShortcutOptions(report);
```

Add the helper near `buildShortcutIndex()`:

```ts
function missionShortcutOptions(report: StartReport): StartShortcutCommandOptions {
  return {
    ...(report.modeSource === 'explicit' ? { mode: report.mode } : {}),
    ...(report.missionControl.intent ? { intent: report.missionControl.intent } : {}),
  };
}
```

Then write:

```ts
await fs.writeFile(
  path.join(targetDir, 'shortcuts.json'),
  JSON.stringify(buildShortcutIndex(report, shortcutOptions), null, 2) + '\n',
  'utf-8',
);
```

Place it after `ready-tool-calls.json` and before `proof-commands.txt`.

- [ ] **Step 7: Add bundle file entry**

In `missionBundleFiles()`, add after `ready-tool-calls.json`:

```ts
{
  name: 'shortcuts.json',
  path: path.join(targetDir, 'shortcuts.json'),
  description: 'Machine-readable Mission Control shortcut command index.',
},
```

- [ ] **Step 8: Run focused green tests**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission uses JSON format|shortcut index|shortcuts-json" --test-timeout 60000 --hook-timeout 60000
```

Expected: build and focused tests pass.

## Task 3: Docs, Screenshots, And Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README**

Add `--shortcuts-json` to the Mission Control shortcut block:

```md
projscan start --shortcuts-json --intent "<goal>"    # Shortcut menu as JSON
```

Add `shortcuts.json` to the saved mission bundle file list after `ready-tool-calls.json`.

Add this row to the options table:

```md
| `--shortcuts-json` | Print the Mission Control shortcut command index as JSON (`start`) |
```

- [ ] **Step 2: Update GUIDE**

In the Mission Control shortcut paragraph, mention `projscan start --shortcuts-json --intent "<goal>"` for agents and scripts that need the same shortcut menu without parsing console text.

Add `shortcuts.json` to the saved mission bundle list.

- [ ] **Step 3: Update CHANGELOG**

Add this Unreleased bullet near the other shortcut bullets:

```md
- Added `projscan start --shortcuts-json` and saved `shortcuts.json` mission bundle files so agents can discover shortcut commands without parsing console text.
```

- [ ] **Step 4: Run docs scan and screenshots**

Run:

```bash
rg -n "TBD|TODO|implement later|fill in|game changer|beautifully|frictionless|magical|sky is the limit|seamless|robust|powerful|supercharge|delight|leverage" README.md docs/GUIDE.md CHANGELOG.md docs/superpowers/specs/2026-06-09-shortcuts-json-export-design.md
npm run docs:screenshots
```

Expected: no new unfinished markers or hype language. Existing historical hits outside the changed prose are acceptable after inspection.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm run build
npm run lint
git diff --check
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

Expected: every command exits 0. Known acceptable warnings are the untrusted test plugin warning, HuggingFace 429 semantic fallback, the existing `projscan_start` stability addition, and the packed-install local tarball output.

- [ ] **Step 6: Commit implementation and stop**

Run:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
git commit -m "feat: export shortcuts json"
git status --short
```

Expected: feature worktree is clean after commit. Do not release, publish, deploy, push, merge, or bump the version.
