# Mission Bundle Quickstart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add human and script entrypoints to saved Mission Control bundles.

**Architecture:** Reuse the existing `writeMissionBundle` path. Add three files during bundle writing, include them in `missionBundleFiles`, and generate `README.md` from the same `StartReport` data used by the runbook and shortcut helpers.

**Tech Stack:** TypeScript, Node `fs/promises`, Commander, Vitest, Markdown docs, existing Playwright screenshot script.

---

## File Structure

- Modify `tests/cli/start.test.ts`: extend bundle tests for `README.md`, `next-command.txt`, `next-tool-call.json`, and manifest ordering.
- Modify `src/cli/commands/start.ts`: add writers and helpers for quickstart content.
- Modify `README.md`: describe the saved bundle entrypoints.
- Modify `docs/GUIDE.md`: mention quickstart files in the agent shortcut paragraph.
- Modify `CHANGELOG.md`: update the Unreleased bundle bullet.
- Modify `docs/demos/projscan-4-1-demo.html`: tune screenshot source copy.
- Regenerate `docs/projscan-mission-control.png` and `docs/projscan-proof-router.png`.

## Task 1: Bundle Quickstart Tests

- [ ] **Step 1: Extend file summary assertions**

In `start writes a Mission Control bundle when requested`, add assertions that stdout contains:

```ts
expect(result.stdout).toContain('README.md');
expect(result.stdout).toContain('next-command.txt');
expect(result.stdout).toContain('next-tool-call.json');
```

- [ ] **Step 2: Add content assertions**

In the same test, after `const bundleDir = ...`, add:

```ts
const quickstart = await fs.readFile(path.join(bundleDir, 'README.md'), 'utf-8');
expect(quickstart).toContain('# Mission Bundle');
expect(quickstart).toContain('Intent: what breaks if I rename the auth token loader');
expect(quickstart).toContain('Status: needs_attention');
expect(quickstart).toContain('Current step: ready-1 in ready_now');
expect(quickstart).toContain('```sh\nprojscan search "auth token loader" --format json\n```');
expect(quickstart).toContain('MCP call: `projscan_search {"query":"auth token loader"}`');
expect(quickstart).toContain('- `runbook.md`: Human-readable Mission Control runbook.');

const nextCommand = await fs.readFile(path.join(bundleDir, 'next-command.txt'), 'utf-8');
expect(nextCommand).toBe('projscan search "auth token loader" --format json\n');

const nextToolCall = JSON.parse(await fs.readFile(path.join(bundleDir, 'next-tool-call.json'), 'utf-8'));
expect(nextToolCall).toEqual({
  tool: 'projscan_search',
  args: { query: 'auth token loader' },
});
```

- [ ] **Step 3: Update manifest ordering assertion**

Change the manifest file list to:

```ts
expect(manifest.files.map((file: { name: string }) => file.name)).toEqual([
  'README.md',
  'next-command.txt',
  'next-tool-call.json',
  'runbook.md',
  'handoff.json',
  'resume.json',
  'ready-tool-calls.json',
  'proof-commands.txt',
  'manifest.json',
]);
```

- [ ] **Step 4: Extend JSON write-report test**

Change the JSON write-report assertion to expect both `README.md` and `manifest.json`:

```ts
expect(payload.missionBundle.files.map((file: { name: string }) => file.name)).toEqual(
  expect.arrayContaining(['README.md', 'next-command.txt', 'next-tool-call.json', 'manifest.json']),
);
```

- [ ] **Step 5: Run the red test**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission" --test-timeout 60000 --hook-timeout 60000
```

Expected: FAIL because the three new files do not exist and the manifest list omits them.

## Task 2: Bundle Quickstart Implementation

- [ ] **Step 1: Add the quickstart file writes**

In `writeMissionBundle`, after `await fs.mkdir(...)`, write:

```ts
await fs.writeFile(path.join(targetDir, 'README.md'), missionBundleReadme(report, files), 'utf-8');
await fs.writeFile(path.join(targetDir, 'next-command.txt'), missionBundleNextCommand(report), 'utf-8');
await fs.writeFile(
  path.join(targetDir, 'next-tool-call.json'),
  JSON.stringify(nextToolCall(report) ?? null) + '\n',
  'utf-8',
);
```

- [ ] **Step 2: Add manifest file entries**

At the start of `missionBundleFiles`, add entries for `README.md`, `next-command.txt`, and `next-tool-call.json` with specific descriptions.

- [ ] **Step 3: Add content helpers**

Add:

```ts
function missionBundleReadme(report: StartReport, files: MissionBundleFile[]): string {
  const mission = report.missionControl;
  const cursor = mission.executionPlan.cursor;
  const lines = [
    '# Mission Bundle',
    '',
    ...(mission.intent ? [`Intent: ${mission.intent}`] : []),
    `Mode: ${report.mode}`,
    `Status: ${mission.status}`,
    `Current step: ${cursor.stepId} in ${cursor.phaseId}`,
    '',
    '## Run Next',
    '',
  ];

  if (cursor.command) {
    lines.push('```sh', cursor.command, '```');
  } else {
    lines.push(mission.resume.instruction);
  }

  const toolCall = nextToolCall(report);
  if (toolCall) {
    lines.push('', `MCP call: \`${toolCall.tool} ${JSON.stringify(toolCall.args ?? {})}\``);
  }

  lines.push('', '## Files');
  for (const file of files) {
    lines.push(`- \`${file.name}\`: ${file.description}`);
  }

  return lines.join('\n').trimEnd() + '\n';
}

function missionBundleNextCommand(report: StartReport): string {
  return `${report.missionControl.executionPlan.cursor.command ?? report.missionControl.resume.instruction}\n`;
}
```

- [ ] **Step 4: Run the green focused test**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission" --test-timeout 60000 --hook-timeout 60000
```

Expected: PASS.

## Task 3: Docs And Screenshots

- [ ] **Step 1: Update README**

Change the shortcut comment for `--save-mission` to:

```bash
projscan start --save-mission .projscan/mission --intent "<goal>" # Write bundle + quickstart
```

Add one sentence after the shortcut block:

```md
Saved mission bundles include `README.md`, `next-command.txt`, `next-tool-call.json`, the Markdown runbook, structured handoff/resume JSON, proof commands, and a manifest.
```

- [ ] **Step 2: Update guide**

Change the guide sentence to name `README.md`, `next-command.txt`, and `next-tool-call.json`.

- [ ] **Step 3: Update changelog**

Update the existing `--save-mission` bullet so it mentions the quickstart README and next-step files.

- [ ] **Step 4: Update demo HTML**

Adjust the save-mission command line or nearby text so the generated screenshot shows "quickstart" or "bundle + quickstart" without adding clutter.

- [ ] **Step 5: Regenerate and inspect screenshots**

Run:

```bash
npm run docs:screenshots
```

Inspect:

```bash
open docs/projscan-mission-control.png
open docs/projscan-proof-router.png
```

## Task 4: Verification And Commit

- [ ] **Step 1: Build**

Run:

```bash
npm run build
```

- [ ] **Step 2: Run focused start suites**

Run:

```bash
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

- [ ] **Step 3: Run lint and diff checks**

Run:

```bash
npm run lint
git diff --check
```

- [ ] **Step 4: Smoke the live bundle**

Run:

```bash
tmpdir=$(mktemp -d)
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --save-mission "$tmpdir/mission" --quiet
sed -n '1,40p' "$tmpdir/mission/README.md"
cat "$tmpdir/mission/next-command.txt"
cat "$tmpdir/mission/next-tool-call.json"
rm -rf "$tmpdir"
```

- [ ] **Step 5: Run broader guards**

Run:

```bash
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

- [ ] **Step 6: Review and commit**

Run:

```bash
git status --short
git diff --stat
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md docs/demos/projscan-4-1-demo.html docs/projscan-mission-control.png docs/projscan-proof-router.png
git commit -m "feat: add mission bundle quickstart files"
```

## Self-Review

- The plan covers tests, implementation, docs, screenshots, and verification.
- Existing bundle files are preserved.
- New files are additive and listed in the manifest.
- No placeholders remain.
