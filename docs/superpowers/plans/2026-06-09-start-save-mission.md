# Start Save Mission Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `projscan start --save-mission <dir>`, a write option that persists the current Mission Control handoff as a small local artifact bundle.

**Architecture:** Keep core Mission Control data unchanged. Implement bundle writing inside `src/cli/commands/start.ts` using the existing CLI report and local helper functions for file assembly. Use root-relative path resolution, recursive directory creation, and JSON/console write reporting like `projscan handoff --write`.

**Tech Stack:** TypeScript, Node `fs/promises`, Node `path`, Commander, Vitest, Markdown docs, existing Playwright screenshot script.

---

## File Structure

- Modify `tests/cli/start.test.ts`: add red tests for bundle writing, JSON write reporting, and shortcut discovery.
- Modify `src/cli/commands/start.ts`: add the option, bundle writer, manifest builder, and console/JSON write reporting.
- Modify `README.md`: add the command to the Mission Control shortcut list and options table.
- Modify `docs/GUIDE.md`: mention the bundle in the shortcut paragraph.
- Modify `CHANGELOG.md`: add an Unreleased bullet.
- Modify `docs/demos/projscan-4-1-demo.html`: add the command to the screenshot source.
- Regenerate `docs/projscan-mission-control.png` and `docs/projscan-proof-router.png` if the screenshot source changes.

## Task 1: CLI Bundle Tests

- [ ] **Step 1: Add the bundle write test**

Add near the existing start shortcut tests in `tests/cli/start.test.ts`:

```ts
test('start writes a Mission Control bundle when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--save-mission',
    'artifacts/mission',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('Wrote Mission Control bundle to');
  expect(result.stdout).toContain('runbook.md');
  expect(result.stdout).toContain('handoff.json');
  expect(result.stdout).toContain('resume.json');
  expect(result.stdout).toContain('ready-tool-calls.json');
  expect(result.stdout).toContain('proof-commands.txt');
  expect(result.stdout).toContain('manifest.json');

  const bundleDir = path.join(tmp, 'artifacts', 'mission');
  const runbook = await fs.readFile(path.join(bundleDir, 'runbook.md'), 'utf-8');
  expect(runbook).toContain('# Mission Runbook');
  expect(runbook).toContain('## Current Cursor');

  const handoff = JSON.parse(await fs.readFile(path.join(bundleDir, 'handoff.json'), 'utf-8'));
  expect(handoff.currentStep.stepId).toBe('ready-1');
  expect(handoff.resume.currentStep.stepId).toBe('ready-1');

  const resume = JSON.parse(await fs.readFile(path.join(bundleDir, 'resume.json'), 'utf-8'));
  expect(resume.currentStep.stepId).toBe('ready-1');

  const readyToolCalls = JSON.parse(await fs.readFile(path.join(bundleDir, 'ready-tool-calls.json'), 'utf-8'));
  expect(readyToolCalls[0]).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });

  const proofCommands = await fs.readFile(path.join(bundleDir, 'proof-commands.txt'), 'utf-8');
  expect(proofCommands).toContain('projscan preflight --mode before_edit --format json');
  expect(proofCommands).not.toContain('projscan search "auth token loader" --format json');

  const manifest = JSON.parse(await fs.readFile(path.join(bundleDir, 'manifest.json'), 'utf-8'));
  expect(manifest).toMatchObject({
    schemaVersion: 1,
    kind: 'projscan.mission-bundle',
    mode: 'before_edit',
    status: 'needs_attention',
    currentStep: {
      phaseId: 'ready_now',
      stepId: 'ready-1',
      command: 'projscan search "auth token loader" --format json',
      toolCall: {
        tool: 'projscan_search',
        args: { query: 'auth token loader' },
      },
    },
  });
  expect(manifest.directory).toBe(bundleDir);
  expect(manifest.files.map((file: { name: string }) => file.name)).toEqual([
    'runbook.md',
    'handoff.json',
    'resume.json',
    'ready-tool-calls.json',
    'proof-commands.txt',
    'manifest.json',
  ]);
});
```

- [ ] **Step 2: Add the JSON write reporting test**

Add:

```ts
test('start reports the Mission Control bundle as JSON when save-mission uses JSON format', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--save-mission',
    'artifacts/json-mission',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const payload = JSON.parse(result.stdout);
  const bundleDir = path.join(tmp, 'artifacts', 'json-mission');
  expect(payload.missionBundle.directory).toBe(bundleDir);
  expect(payload.missionBundle.files.map((file: { name: string }) => file.name)).toContain('manifest.json');
  const manifest = JSON.parse(await fs.readFile(path.join(bundleDir, 'manifest.json'), 'utf-8'));
  expect(manifest.directory).toBe(bundleDir);
});
```

- [ ] **Step 3: Extend the shortcut menu test**

In `start prints a shortcut index for the current mission when requested`, add:

```ts
expect(result.stdout).toContain("projscan start --save-mission .projscan/mission --intent 'what breaks if I rename the auth token loader'");
```

- [ ] **Step 4: Run the red test**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission|shortcut index" --test-timeout 60000 --hook-timeout 60000
```

Expected: FAIL because Commander rejects unknown option `--save-mission`, and the shortcut index omits it.

## Task 2: CLI Implementation

- [ ] **Step 1: Add imports**

At the top of `src/cli/commands/start.ts`, add:

```ts
import fs from 'node:fs/promises';
import path from 'node:path';
```

- [ ] **Step 2: Add the Commander option**

Near the other start options, add:

```ts
.option('--save-mission <dir>', 'write the Mission Control bundle to this directory')
```

- [ ] **Step 3: Use one root path**

Inside the action, set:

```ts
const rootPath = getRootPath();
```

Pass `rootPath` into `computeStartReport`.

- [ ] **Step 4: Add write handling before output shortcuts**

After computing the report and before the `format === 'json'` full-report branch, add:

```ts
if (typeof cmdOpts.saveMission === 'string' && cmdOpts.saveMission.length > 0) {
  const missionBundle = await writeMissionBundle(rootPath, cmdOpts.saveMission, report);
  if (format === 'json') {
    console.log(JSON.stringify({ missionBundle }, null, 2));
    return;
  }
  printMissionBundle(missionBundle);
  return;
}
```

- [ ] **Step 5: Add bundle helper types and functions**

Add local helpers below `readyProofCommands`:

```ts
interface MissionBundleFile {
  name: string;
  path: string;
  description: string;
}

interface MissionBundleManifest {
  schemaVersion: 1;
  kind: 'projscan.mission-bundle';
  directory: string;
  intent?: string;
  mode: StartReport['mode'];
  status: StartReport['missionControl']['status'];
  currentStep?: {
    phaseId: string;
    stepId: string;
    command?: string;
    toolCall?: StartMissionToolCall;
  };
  files: MissionBundleFile[];
}
```

Then add `writeMissionBundle`, `missionBundleFiles`, `missionBundleCurrentStep`, and `printMissionBundle` as implementation helpers.

- [ ] **Step 6: Add shortcut menu entry**

In `printShortcutsOnly`, after `--handoff-json`, add:

```ts
shortcutCommand('--save-mission .projscan/mission', options),
```

- [ ] **Step 7: Run the green focused test**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "Mission Control bundle|save-mission|shortcut index" --test-timeout 60000 --hook-timeout 60000
```

Expected: PASS for bundle writing, JSON write reporting, and shortcut index coverage.

## Task 3: Docs And Screenshots

- [ ] **Step 1: Update README**

Add to the Mission Control shortcut block:

```bash
projscan start --save-mission .projscan/mission --intent "<goal>" # Write handoff bundle
```

Add to the options table:

```md
| `--save-mission <dir>` | Write the Mission Control bundle to a directory (`start`) |
```

- [ ] **Step 2: Update guide**

In the shortcut paragraph, add:

```md
For a file bundle, `projscan start --save-mission .projscan/mission --intent "<goal>"` writes the runbook, handoff JSON, resume JSON, MCP calls, proof commands, and manifest.
```

- [ ] **Step 3: Update changelog**

Add:

```md
- Added `projscan start --save-mission <dir>`, which writes a Mission Control handoff bundle with Markdown, JSON, MCP calls, proof commands, and a manifest.
```

- [ ] **Step 4: Update demo HTML**

Add `projscan start --save-mission .projscan/mission --intent "..."` to the “Copyable Shortcuts” terminal block in `docs/demos/projscan-4-1-demo.html`.

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

- [ ] **Step 4: Smoke the live write option**

Run:

```bash
rm -rf .projscan/mission-smoke
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --save-mission .projscan/mission-smoke --quiet
find .projscan/mission-smoke -maxdepth 1 -type f | sort
rm -rf .projscan/mission-smoke
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
git commit -m "feat: add start mission bundle writer"
```

## Self-Review

- The plan covers behavior, docs, screenshots, and verification from the design.
- The implementation keeps core and MCP schemas unchanged.
- The planned tests exercise filesystem output and JSON write reporting.
- No placeholders remain.
