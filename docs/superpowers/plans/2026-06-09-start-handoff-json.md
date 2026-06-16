# Start Handoff JSON Shortcut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `projscan start --handoff-json`, a compact JSON shortcut for the existing Mission Control handoff object.

**Architecture:** Keep core Mission Control data unchanged. Add a Commander flag and a console-only branch in `src/cli/commands/start.ts` that prints `report.missionControl.handoff` before broader runbook/shortcut outputs. Update docs and screenshots to expose the new shortcut.

**Tech Stack:** TypeScript, Commander, Vitest, Markdown docs, existing Playwright screenshot script.

---

## File Structure

- Modify `tests/cli/start.test.ts`: add red tests for `--handoff-json`, JSON behavior, and shortcut menu coverage.
- Modify `src/cli/commands/start.ts`: add the CLI flag and output branch.
- Modify `README.md`: add the shortcut to the Mission Control shortcut list and options table.
- Modify `docs/GUIDE.md`: mention the whole handoff object shortcut in the agent flow shortcut paragraph.
- Modify `CHANGELOG.md`: add an Unreleased bullet.
- Modify `docs/demos/projscan-4-1-demo.html`: add the command to the screenshot source.
- Regenerate `docs/projscan-mission-control.png` and `docs/projscan-proof-router.png` with `npm run docs:screenshots`.

## Task 1: CLI Behavior

- [ ] **Step 1: Add the failing handoff JSON shortcut test**

Add near the existing resume/runbook shortcut tests in `tests/cli/start.test.ts`:

```ts
test('start prints only the handoff object as compact JSON when requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--handoff-json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  const handoff = JSON.parse(result.stdout);
  expect(handoff.currentStep.stepId).toBe('ready-1');
  expect(handoff.resume.currentStep.stepId).toBe('ready-1');
  expect(handoff.resume.toolCall).toEqual({
    tool: 'projscan_search',
    args: { query: 'auth token loader' },
  });
  expect(handoff.readyProof.commands).toEqual(handoff.resume.remainingProofCommands);
  expect(handoff.readyProof.toolCalls).toEqual(handoff.resume.remainingProofToolCalls);
  expect(result.stdout).not.toContain('Start:');
  expect(result.stdout).not.toContain('Mission Control');
  expect(result.stdout).not.toContain('Handoff Prompt');
});
```

- [ ] **Step 2: Add the JSON compatibility test**

Add near the shortcut JSON compatibility tests:

```ts
test('start JSON keeps the full report when handoff-json shortcut is requested', async () => {
  const result = await runCli([
    'start',
    '--intent',
    'what breaks if I rename the auth token loader',
    '--handoff-json',
    '--format',
    'json',
    '--quiet',
  ]);

  expect(result.exitCode).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.missionControl.handoff.currentStep.stepId).toBe('ready-1');
  expect(report.missionControl.handoff.resume).toEqual(report.missionControl.resume);
});
```

- [ ] **Step 3: Extend the shortcut menu assertion**

In `start prints a shortcut index for the current mission when requested`, add:

```ts
expect(result.stdout).toContain(
  "projscan start --handoff-json --intent 'what breaks if I rename the auth token loader'",
);
```

- [ ] **Step 4: Run the focused red test**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "handoff object|handoff-json|shortcut index" --test-timeout 60000 --hook-timeout 60000
```

Expected: FAIL because Commander rejects unknown option `--handoff-json`, and the shortcut index omits it.

- [ ] **Step 5: Add the CLI flag**

In `src/cli/commands/start.ts`, near the other start shortcut flags, add:

```ts
.option('--handoff-json', 'print only the Mission Control handoff object as compact JSON')
```

- [ ] **Step 6: Add the output branch**

After the `--resume-json` branch and before `--runbook`, add:

```ts
if (cmdOpts.handoffJson === true) {
  console.log(JSON.stringify(report.missionControl.handoff));
  return;
}
```

- [ ] **Step 7: Add the menu entry**

In `printShortcutsOnly`, insert:

```ts
shortcutCommand('--handoff-json', options),
```

after `shortcutCommand('--resume-json', options),`.

- [ ] **Step 8: Run the focused green test**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "handoff object|handoff-json|shortcut index" --test-timeout 60000 --hook-timeout 60000
```

Expected: PASS for the new shortcut behavior and the existing shortcut index tests.

## Task 2: Docs And Screenshots

- [ ] **Step 1: Update README copy**

Add to the Mission Control shortcut block:

```bash
projscan start --handoff-json --intent "<goal>"    # Complete handoff object
```

Add to the options table:

```md
| `--handoff-json` | Print only the Mission Control handoff object as JSON (`start`) |
```

- [ ] **Step 2: Update guide copy**

In the shortcut paragraph, add:

```md
For a complete structured transfer object, `projscan start --handoff-json --intent "<goal>"` prints only `missionControl.handoff`.
```

- [ ] **Step 3: Update changelog**

Add under Unreleased `Added`:

```md
- Added `projscan start --handoff-json`, a console shortcut that prints only the structured Mission Control handoff object.
```

- [ ] **Step 4: Update demo HTML**

Add `projscan start --handoff-json --intent "..."` to the “Copyable Shortcuts” terminal block in `docs/demos/projscan-4-1-demo.html`.

- [ ] **Step 5: Regenerate and inspect screenshots**

Run:

```bash
npm run docs:screenshots
```

Then inspect:

```bash
open docs/projscan-mission-control.png
open docs/projscan-proof-router.png
```

## Task 3: Verification And Commit

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

- [ ] **Step 4: Smoke the live shortcut**

Run:

```bash
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --handoff-json --quiet
```

Expected: stdout is one compact JSON object with `currentStep`, `resume`, and `readyProof`.

- [ ] **Step 5: Run broader release-adjacent checks**

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
git add tests/cli/start.test.ts src/cli/commands/start.ts README.md docs/GUIDE.md CHANGELOG.md docs/demos/projscan-4-1-demo.html docs/projscan-mission-control.png docs/projscan-proof-router.png
git commit -m "feat: add start handoff json shortcut"
```

## Self-Review

- The plan covers behavior, docs, screenshots, and verification from the design.
- The implementation keeps core data unchanged and adds only console shortcut rendering.
- No placeholders remain.
- Type names and flag names match the existing Commander camel-case convention.
