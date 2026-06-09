# Mission Review Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured Mission Control review gate that tells humans and MCP agents to finish the current mission, gather proof, and wait for approval before starting more work or releasing.

**Architecture:** `src/core/start.ts` owns the review-gate object and Markdown renderer. CLI shortcuts and mission bundles read from `report.missionControl.reviewGate` so JSON, MCP, console, task-card, runbook, and saved files share one source.

**Tech Stack:** TypeScript, Commander CLI, Vitest, Playwright screenshot capture through `npm run docs:screenshots`.

---

## File Structure

- Modify `src/types.ts`: add `StartMissionReviewGate` and include it on `StartMissionControl`.
- Modify `src/core/start.ts`: build `missionControl.reviewGate`, render Markdown, and include the gate in task card/runbook Markdown.
- Modify `src/cli/commands/start.ts`: add `--review-gate`, print the gate Markdown, include it in shortcut output, write `review-gate.md`, and list it in the bundle manifest.
- Modify `tests/core/start.test.ts`: assert the structured review gate and Markdown surfaces.
- Modify `tests/cli/start.test.ts`: assert shortcut parity and saved bundle output.
- Modify `tests/mcp/start.test.ts`: assert MCP returns the gate.
- Modify `README.md`, `docs/GUIDE.md`, `CHANGELOG.md`, and `docs/demos/projscan-4-1-demo.html`: document the new surface and refresh screenshots.

## Task 1: Red Tests

**Files:**
- Modify: `tests/core/start.test.ts`
- Modify: `tests/cli/start.test.ts`
- Modify: `tests/mcp/start.test.ts`

- [ ] **Step 1: Add core failing assertions**

Add this assertion block to the existing task-card focused core test, or add a new nearby test if the existing test has drifted:

```ts
expect(report.missionControl.reviewGate).toEqual(
  expect.objectContaining({
    title: 'Mission Review Gate',
    required: true,
    status: report.missionControl.status,
    stopCondition: expect.stringContaining('Stop after'),
  }),
);
expect(report.missionControl.reviewGate.commands).toEqual(['git status --short', 'git diff --stat']);
expect(report.missionControl.reviewGate.checklist).toEqual(
  expect.arrayContaining([
    'Complete this task card and remaining proof.',
    'Capture `git status --short`.',
    'Capture `git diff --stat`.',
    'Stop and ask for approval before starting another slice, release, publish, or deploy.',
  ]),
);
expect(report.missionControl.reviewGate.markdown).toContain('# Mission Review Gate');
expect(report.missionControl.taskCard.markdown).toContain('## Review Gate');
expect(report.missionControl.runbook.markdown).toContain('## Review Gate');
```

- [ ] **Step 2: Add CLI failing assertions**

Add a CLI test that compares JSON and shortcut output:

```ts
test('start review-gate shortcut prints the structured review gate markdown', async () => {
  const json = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--format',
    'json',
    '--quiet',
  ]);
  const shortcut = await runCli([
    'start',
    '--review-gate',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--quiet',
  ]);

  expect(json.exitCode).toBe(0);
  expect(shortcut.exitCode).toBe(0);
  const report = JSON.parse(json.stdout);
  expect(shortcut.stdout).toBe(report.missionControl.reviewGate.markdown);
});
```

Extend the shortcuts test:

```ts
expect(result.stdout).toContain('projscan start --review-gate --intent "what breaks if I rename the auth token loader"');
```

Extend the bundle test:

```ts
expect(manifest.files.map((file: { name: string }) => file.name)).toContain('review-gate.md');
expect(await fs.readFile(path.join(bundleDir, 'review-gate.md'), 'utf-8')).toContain('# Mission Review Gate');
```

- [ ] **Step 3: Add MCP failing assertions**

In the fuzzy impact MCP test, add:

```ts
expect(result.start.missionControl.reviewGate).toEqual(
  expect.objectContaining({
    title: 'Mission Review Gate',
    required: true,
    commands: ['git status --short', 'git diff --stat'],
  }),
);
expect(result.start.missionControl.reviewGate.markdown).toContain('# Mission Review Gate');
```

- [ ] **Step 4: Run red tests**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "review gate|task card|fuzzy impact|Mission Control bundle|shortcuts" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `missionControl.reviewGate` and `--review-gate` do not exist yet.

## Task 2: Core Review Gate

**Files:**
- Modify: `src/types.ts`
- Modify: `src/core/start.ts`

- [ ] **Step 1: Add types**

Add this interface before `StartMissionRunbook`:

```ts
export interface StartMissionReviewGate {
  title: string;
  required: true;
  status: StartMissionControlStatus;
  stopCondition: string;
  reviewPrompt: string;
  checklist: string[];
  commands: string[];
  markdown: string;
}
```

Add this property to `StartMissionControl`:

```ts
reviewGate: StartMissionReviewGate;
```

- [ ] **Step 2: Build the gate before runbook/task-card**

In `buildMissionControl`, after `handoffPrompt`, add:

```ts
const reviewGate = buildMissionReviewGate({
  status,
  proofSummary: READY_PROOF_SUMMARY,
});
```

Pass `reviewGate` into `buildMissionRunbook` and `buildMissionTaskCard`, and return it on `missionControl`.

- [ ] **Step 3: Add renderer helpers**

Add:

```ts
function buildMissionReviewGate(input: {
  status: StartMissionControlStatus;
  proofSummary: string;
}): StartMissionReviewGate {
  const checklist = [
    'Complete this task card and remaining proof.',
    'Capture `git status --short`.',
    'Capture `git diff --stat`.',
    'Stop and ask for approval before starting another slice, release, publish, or deploy.',
  ];
  const commands = ['git status --short', 'git diff --stat'];
  const stopCondition = 'Stop after the current Mission Control checklist and proof are complete.';
  const reviewPrompt = `Review the completed mission, proof output, and working-tree summary before approving another slice, release, publish, or deploy. ${input.proofSummary}`;
  return {
    title: 'Mission Review Gate',
    required: true,
    status: input.status,
    stopCondition,
    reviewPrompt,
    checklist,
    commands,
    markdown: renderMissionReviewGateMarkdown({
      status: input.status,
      stopCondition,
      reviewPrompt,
      checklist,
      commands,
    }),
  };
}

function renderMissionReviewGateMarkdown(input: {
  status: StartMissionControlStatus;
  stopCondition: string;
  reviewPrompt: string;
  checklist: string[];
  commands: string[];
}): string {
  const lines = [
    '# Mission Review Gate',
    '',
    `Status: ${input.status}`,
    `Stop condition: ${input.stopCondition}`,
    '',
    '## Checklist',
    ...input.checklist.map((item) => `- [ ] ${item}`),
    '',
    '## Evidence Commands',
    ...input.commands.map((command) => `- \`${command}\``),
    '',
    '## Review Prompt',
    input.reviewPrompt,
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}
```

- [ ] **Step 4: Include gate in runbook and task card Markdown**

Add `reviewGate` to both input types and insert:

```ts
'## Review Gate',
...input.reviewGate.checklist.map((item) => `- [ ] ${item}`),
'',
```

For the runbook, also include:

```ts
input.reviewGate.reviewPrompt,
'',
```

- [ ] **Step 5: Run green tests for core**

Run:

```bash
npm run build && npx vitest run tests/core/start.test.ts --testNamePattern "review gate|task card" --test-timeout 60000 --hook-timeout 60000
```

Expected: build passes and focused core tests pass.

## Task 3: CLI, Shortcuts, and Bundle

**Files:**
- Modify: `src/cli/commands/start.ts`
- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add CLI option and branch**

Add:

```ts
.option('--review-gate', 'print only the Mission Control review gate')
```

Before `--shortcuts`, add:

```ts
if (cmdOpts.reviewGate === true) {
  printReviewGateOnly(report);
  return;
}
```

Add:

```ts
function printReviewGateOnly(report: StartReport): void {
  const reviewGate = report.missionControl.reviewGate.markdown.trimEnd();
  if (reviewGate.length === 0) {
    console.error(chalk.red('No Mission Control review gate is available.'));
    process.exit(1);
  }
  console.log(reviewGate);
}
```

- [ ] **Step 2: Add shortcut and bundle file**

Add `shortcutCommand('--review-gate', options)` to the shortcuts array.

Write the file in `writeMissionBundle`:

```ts
await fs.writeFile(
  path.join(targetDir, 'review-gate.md'),
  report.missionControl.reviewGate.markdown,
  'utf-8',
);
```

Add to `missionBundleFiles` after `task-card.md`:

```ts
{
  name: 'review-gate.md',
  path: path.join(targetDir, 'review-gate.md'),
  description: 'Stop-and-review gate for approving another slice, release, publish, or deploy.',
},
```

- [ ] **Step 3: Run green tests for CLI and MCP**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "review gate|fuzzy impact|Mission Control bundle|shortcuts" --test-timeout 60000 --hook-timeout 60000
```

Expected: build passes and focused CLI/MCP tests pass.

## Task 4: Docs, Screenshots, and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/demos/projscan-4-1-demo.html`
- Modify: `docs/projscan-mission-control.png`
- Modify: `docs/projscan-proof-router.png`

- [ ] **Step 1: Update prose**

Document:

- `missionControl.reviewGate`
- `projscan start --review-gate`
- `review-gate.md` in saved mission bundles

Use direct prose and avoid filler.

- [ ] **Step 2: Update demo HTML**

Add visible copy for the review gate in the Mission Control capture and proof workflow capture.

- [ ] **Step 3: Regenerate screenshots**

Run:

```bash
command -v npx >/dev/null 2>&1 && npm run docs:screenshots
```

Expected: Playwright writes `docs/projscan-mission-control.png` and `docs/projscan-proof-router.png`.

- [ ] **Step 4: Full verification**

Run:

```bash
npm run build
npm run lint
git diff --check
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

Expected: all commands exit 0. Known external warnings are acceptable only if the command exits 0.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add src/types.ts src/core/start.ts src/cli/commands/start.ts tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts README.md docs/GUIDE.md CHANGELOG.md docs/demos/projscan-4-1-demo.html docs/projscan-mission-control.png docs/projscan-proof-router.png
git commit -m "feat: add mission review gate"
```

Expected: one feature commit. Do not release, publish, push, deploy, or change `package.json` version.
