# Mission Task Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a paste-ready Mission Task Card shortcut and saved bundle artifact for `projscan start`.

**Architecture:** Render the task card from the existing `StartReport` inside `src/cli/commands/start.ts`. Keep it presentation-only: no new core JSON contract, no changed stable keys, and no replacement for the full runbook.

**Tech Stack:** TypeScript, Commander CLI, Vitest, Playwright-backed docs screenshot script.

---

## File Structure

- Modify `src/cli/commands/start.ts`: add `--task-card`, task-card renderer helpers, bundle file write, bundle file list entry, shortcut menu entry.
- Modify `tests/cli/start.test.ts`: add red tests for `--task-card`, saved `task-card.md`, manifest order, and JSON bundle file list.
- Modify `README.md`: add shortcut and saved bundle file wording.
- Modify `docs/GUIDE.md`: add shortcut and saved bundle file wording.
- Modify `CHANGELOG.md`: add unreleased bullet.
- Modify `docs/demos/projscan-4-1-demo.html`: adjust saved-bundle demo copy if needed.
- Regenerate `docs/projscan-mission-control.png` with `npm run docs:screenshots`.

---

### Task 1: Red Test For `--task-card`

**Files:**

- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add the failing shortcut test**

Add this test near the other `start` shortcut tests:

```ts
test('start prints only the mission task card when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--task-card',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.startsWith('# Mission Task Card\n')).toBe(true);
  expect(result.stdout).toContain('Intent: what breaks if I rename the auth token loader');
  expect(result.stdout).toContain('Status: needs_attention');
  expect(result.stdout).toContain('Current step: ready-1 in ready_now');
  expect(result.stdout).toContain('## Do Next');
  expect(result.stdout).toContain('- [ ] Run `projscan search "auth token loader" --format json`');
  expect(result.stdout).toContain('(MCP: projscan_search {"query":"auth token loader"})');
  expect(result.stdout).toContain(
    '- [ ] Resolve `input-1` (`symbol`): Replace <symbol-from-search> with an exported symbol returned by the search step.',
  );
  expect(result.stdout).toContain('## Proof');
  expect(result.stdout).toContain(
    '- [ ] `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})',
  );
  expect(result.stdout).toContain(
    '- [ ] `projscan understand --view verify --format json` (MCP: projscan_understand {"view":"verify"})',
  );
  expect(result.stdout).toContain('## Done When');
  expect(result.stdout).toContain(
    '- [ ] An exact symbol or file path is selected from search results before impact analysis continues.',
  );
  expect(result.stdout).toContain('## Handoff Prompt');
  expect(result.stdout).toContain('Resume: Resume at ready-1 in ready_now');
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout.endsWith('\n')).toBe(true);
});
```

- [ ] **Step 2: Run the focused red test**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "mission task card" --test-timeout 60000 --hook-timeout 60000
```

Expected: FAIL because Commander does not know `--task-card`, or because output does not start with `# Mission Task Card`.

---

### Task 2: Red Test For Saved Bundle File

**Files:**

- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Extend the saved mission bundle test**

In `start writes a Mission Control bundle when requested`, add:

```ts
expect(result.stdout).toContain('task-card.md');
expect(quickstart).toContain(
  '- `task-card.md`: Paste-ready Markdown task card for PRs, issues, and handoffs.',
);

const taskCard = await fs.readFile(path.join(bundleDir, 'task-card.md'), 'utf-8');
expect(taskCard.startsWith('# Mission Task Card\n')).toBe(true);
expect(taskCard).toContain('- [ ] Run `projscan search "auth token loader" --format json`');
expect(taskCard).toContain('- [ ] `projscan preflight --mode before_edit --format json`');
expect(taskCard).toContain('## Handoff Prompt');
expect(taskCard.endsWith('\n')).toBe(true);
```

Update the expected manifest file order:

```ts
expect(manifest.files.map((file: { name: string }) => file.name)).toEqual([
  'README.md',
  'next-command.txt',
  'next-tool-call.json',
  'handoff-prompt.txt',
  'resume-prompt.txt',
  'task-card.md',
  'runbook.md',
  'handoff.json',
  'resume.json',
  'ready-tool-calls.json',
  'proof-commands.txt',
  'manifest.json',
]);
```

- [ ] **Step 2: Extend the JSON bundle test**

In `start reports the Mission Control bundle as JSON when save-mission uses JSON format`, add `task-card.md` to the `arrayContaining` expectation.

- [ ] **Step 3: Run the focused red bundle tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission" --test-timeout 60000 --hook-timeout 60000
```

Expected: FAIL because `task-card.md` is not written or listed yet.

---

### Task 3: Implement Task Card Rendering And CLI Shortcut

**Files:**

- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Add the Commander option**

Add beside the other start shortcut options:

```ts
.option('--task-card', 'print only the Mission Control Markdown task card')
```

- [ ] **Step 2: Route the shortcut**

Add after `--runbook` handling and before `--shortcuts` handling:

```ts
if (cmdOpts.taskCard === true) {
  printTaskCardOnly(report);
  return;
}
```

- [ ] **Step 3: Add the print helper**

Add near `printRunbookOnly`:

```ts
function printTaskCardOnly(report: StartReport): void {
  const taskCard = renderMissionTaskCard(report).trimEnd();
  if (taskCard.length === 0) {
    console.error(chalk.red('No Mission Control task card is available.'));
    process.exit(1);
  }
  console.log(taskCard);
}
```

- [ ] **Step 4: Add the renderer helpers**

Add helpers in `src/cli/commands/start.ts`:

```ts
function renderMissionTaskCard(report: StartReport): string {
  const mission = report.missionControl;
  const cursor = mission.executionPlan.cursor;
  const lines = [
    '# Mission Task Card',
    '',
    ...(mission.intent ? [`Intent: ${mission.intent}`] : []),
    `Status: ${mission.status}`,
    `Current step: ${cursor.stepId} in ${cursor.phaseId}`,
    '',
    '## Do Next',
    ...missionTaskCardActionLines(report),
    '',
    '## Proof',
    ...missionTaskCardProofLines(report),
    '',
    '## Done When',
    ...(mission.successCriteria.length > 0
      ? mission.successCriteria.map((criterion) => `- [ ] ${criterion}`)
      : ['- [ ] The next action is complete and verified.']),
    '',
    '## Handoff Prompt',
    mission.handoffPrompt,
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}

function missionTaskCardActionLines(report: StartReport): string[] {
  const checklist = report.missionControl.resume.checklist ?? [];
  const actionLines = checklist
    .filter((item) => item.kind !== 'run_proof' && item.kind !== 'confirm_done')
    .map(formatTaskCardChecklistItem);
  return actionLines.length > 0
    ? actionLines
    : ['- [ ] Continue from the current Mission Control cursor.'];
}

function missionTaskCardProofLines(report: StartReport): string[] {
  const proofItems = report.missionControl.handoff.readyProof.items ?? [];
  const proofLines = proofItems.map(formatTaskCardProofItem);
  if (proofLines.length > 0) return proofLines;
  const commands = readyProofCommands(report);
  return commands.length > 0
    ? commands.map((command) => `- [ ] \`${command}\``)
    : ['- [ ] No proof commands are ready yet.'];
}
```

Add exact formatters that use existing `StartMissionResumeChecklistItem` and `StartMissionProofItem` types:

```ts
function formatTaskCardChecklistItem(item: StartMissionResumeChecklistItem): string {
  if (item.kind === 'resolve_input') {
    const label = item.label ? ` (\`${item.label}\`)` : '';
    const instruction = item.instruction ?? item.label;
    return `- [ ] Resolve \`${item.stepId}\`${label}: ${instruction}`;
  }
  if (item.command) {
    return `- [ ] Run \`${item.command}\`${formatTaskCardChecklistAnnotation(item)}`;
  }
  return `- [ ] ${item.instruction ?? item.label}`;
}

function formatTaskCardChecklistAnnotation(item: StartMissionResumeChecklistItem): string {
  if (!item.tool) return '';
  return ` (MCP: ${formatTaskCardToolCall({ tool: item.tool, ...(typeof item.args !== 'undefined' ? { args: item.args } : {}) })})`;
}

function formatTaskCardProofItem(item: StartMissionProofItem): string {
  const annotation = item.toolCall
    ? ` (MCP: ${formatTaskCardToolCall(item.toolCall)})`
    : ' (CLI only)';
  return `- [ ] \`${item.command}\`${annotation}`;
}

function formatTaskCardToolCall(toolCall: StartMissionToolCall): string {
  return typeof toolCall.args !== 'undefined'
    ? `${toolCall.tool} ${JSON.stringify(toolCall.args)}`
    : toolCall.tool;
}
```

- [ ] **Step 5: Update shortcut index**

Add `shortcutCommand('--task-card', options)` to the `shortcuts` array before `--runbook`.

- [ ] **Step 6: Run the focused green shortcut test**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "mission task card" --test-timeout 60000 --hook-timeout 60000
```

Expected: PASS.

---

### Task 4: Implement Bundle File

**Files:**

- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Write `task-card.md`**

In `writeMissionBundle`, after `resume-prompt.txt`, add:

```ts
await fs.writeFile(path.join(targetDir, 'task-card.md'), renderMissionTaskCard(report), 'utf-8');
```

- [ ] **Step 2: List the file in `missionBundleFiles`**

Add after `resume-prompt.txt`:

```ts
{
  name: 'task-card.md',
  path: path.join(targetDir, 'task-card.md'),
  description: 'Paste-ready Markdown task card for PRs, issues, and handoffs.',
},
```

- [ ] **Step 3: Run the focused green bundle tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission" --test-timeout 60000 --hook-timeout 60000
```

Expected: PASS.

---

### Task 5: Documentation And Screenshot

**Files:**

- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/demos/projscan-4-1-demo.html`
- Regenerate: `docs/projscan-mission-control.png`

- [ ] **Step 1: Update README shortcut list and bundle sentence**

Add:

```md
projscan start --task-card --intent "<goal>" # Paste-ready Markdown task card
```

Update the saved bundle sentence to include `task-card.md`.

- [ ] **Step 2: Update guide prose**

In the long start-command guide paragraph, add `projscan start --task-card --intent "<goal>"` as the paste-ready Markdown task card shortcut and include `task-card.md` in the saved mission bundle file list.

- [ ] **Step 3: Update changelog**

Under Unreleased Added, add:

```md
- Added `projscan start --task-card` and `task-card.md` in saved mission bundles for paste-ready PR, issue, and handoff checklists.
```

- [ ] **Step 4: Update demo copy**

In `docs/demos/projscan-4-1-demo.html`, adjust the saved bundle line to mention task cards if the current copy only says prompts and next-step files.

- [ ] **Step 5: Regenerate screenshot**

Run:

```bash
npm run docs:screenshots
```

Expected: exits 0 and updates `docs/projscan-mission-control.png` if demo pixels changed.

---

### Task 6: Verification And Commit

**Files:**

- All modified files from the slice

- [ ] **Step 1: Build**

Run:

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 2: Focused start tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: exits 0.

- [ ] **Step 3: Lint and diff check**

Run:

```bash
npm run lint
git diff --check
```

Expected: both exit 0.

- [ ] **Step 4: Live smoke**

Run:

```bash
tmpdir=$(mktemp -d); node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --task-card --quiet; node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --save-mission "$tmpdir/mission" --quiet; test -s "$tmpdir/mission/task-card.md"; rm -rf "$tmpdir"
```

Expected: exits 0 and prints a task card plus bundle file list.

- [ ] **Step 5: Full suite and gates**

Run:

```bash
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

Expected: all exit 0.

- [ ] **Step 6: Commit implementation**

Run:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md docs/demos/projscan-4-1-demo.html docs/projscan-mission-control.png
git commit -m "feat: add mission task card"
```

Expected: commit succeeds and `git status --short` is clean.

---

## Plan Self-Review

- Spec coverage: shortcut, saved bundle file, docs, screenshot, and verification are all mapped to tasks.
- Placeholder scan: no `TBD`, `TODO`, or "similar to" steps remain.
- Type consistency: renderer uses existing `StartReport`, `StartMissionResumeChecklistItem`, `StartMissionProofItem`, and `StartMissionToolCall` imports already present in `start.ts`.
