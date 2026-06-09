# Mission Script Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `projscan start --mission-script` and saved `mission.sh` bundles for running the current Mission Control cursor plus remaining proof commands.

**Architecture:** Keep script rendering in `src/cli/commands/start.ts` beside the existing Mission Control export helpers. Reuse `readyProofCommands(report)`, `missionBundleFiles()`, `missionBundleReadme()`, and shortcut/base-command helpers so console output and saved bundles stay consistent.

**Tech Stack:** TypeScript, Commander, Vitest, Markdown docs, existing Playwright screenshot generation.

---

## File Structure

- Modify `tests/cli/start.test.ts`: add red tests for the CLI script shortcut, saved bundle artifact, JSON behavior, and shortcut precedence.
- Modify `src/cli/commands/start.ts`: add `--mission-script`, render a POSIX shell script, write `mission.sh` to saved bundles, list it in the manifest, and expose it in shortcut discovery.
- Modify `README.md`: document the script shortcut, saved bundle file, and option.
- Modify `docs/GUIDE.md`: explain when humans or scripts should use the generated mission script.
- Modify `CHANGELOG.md`: add an Unreleased bullet.
- Modify `docs/demos/projscan-4-1-demo.html`: add the mission-script command to the screenshot source.
- Regenerate docs screenshots with `npm run docs:screenshots`.

### Task 1: Add Red CLI Tests

- [ ] **Step 1: Add the mission-script shortcut test**

Add a test in `tests/cli/start.test.ts` near the shortcut tests. It should run:

```ts
const result = await runCli([
  'start',
  '--intent',
  'what breaks if I rename the auth token loader',
  '--mission-script',
  '--quiet',
]);
```

Expected assertions:

```ts
expect(result.exitCode).toBe(0);
expect(result.stderr).toBe('');
expect(result.stdout.startsWith('#!/usr/bin/env sh\nset -eu\n')).toBe(true);
expect(result.stdout).toContain("printf '%s\\n' 'projscan Mission Control'");
expect(result.stdout).toContain("printf '%s\\n' 'Intent: what breaks if I rename the auth token loader'");
expect(result.stdout).toContain("printf '%s\\n' 'Current step: ready-1 in ready_now'");
expect(result.stdout).toContain("printf '%s\\n' 'Run current command'");
expect(result.stdout).toContain('projscan search "auth token loader" --format json');
expect(result.stdout).toContain("printf '%s\\n' 'Run remaining proof'");
expect(result.stdout).toContain('projscan preflight --mode before_edit --format json');
expect(result.stdout).toContain("printf '%s\\n' 'Review gate'");
expect(result.stdout).toContain("printf '%s\\n' 'Capture: git status --short'");
expect(result.stdout).not.toContain('Mission Control\nStatus:');
expect(result.stdout).not.toContain('Run Cursor');
```

- [ ] **Step 2: Extend the saved bundle test**

In the existing saved mission bundle test, assert:

```ts
expect(result.stdout).toContain('mission.sh');
expect(quickstart).toContain('- `mission.sh`: Shell script that runs the current cursor command and remaining proof queue.');
const missionScript = await fs.readFile(path.join(bundleDir, 'mission.sh'), 'utf-8');
expect(missionScript.startsWith('#!/usr/bin/env sh\nset -eu\n')).toBe(true);
expect(missionScript).toContain('projscan search "auth token loader" --format json');
expect(missionScript).toContain('projscan preflight --mode before_edit --format json');
expect(manifest.files.map((file: { name: string }) => file.name)).toContain('mission.sh');
```

- [ ] **Step 3: Add JSON behavior and precedence tests**

Add one test for `--mission-script --format json` that parses the full report and asserts `missionControl.executionPlan.cursor.command`. Add one test for `--proof-commands --mission-script` that confirms proof output wins over script output.

- [ ] **Step 4: Watch the new tests fail**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "mission script|saved Mission Control bundle|narrower shortcut" --test-timeout 60000 --hook-timeout 60000
```

Expected: tests fail because `--mission-script` and `mission.sh` do not exist yet.

### Task 2: Implement Script Rendering

- [ ] **Step 1: Add the Commander option and branch**

Add:

```ts
.option('--mission-script', 'print the Mission Control shell script')
```

Then route it after narrower focused shortcuts and before `--shortcuts`:

```ts
if (cmdOpts.missionScript === true) {
  printMissionScriptOnly(report);
  return;
}
```

- [ ] **Step 2: Add script helpers**

Add helpers in `src/cli/commands/start.ts`:

```ts
function printMissionScriptOnly(report: StartReport): void {
  console.log(buildMissionScript(report).trimEnd());
}

function buildMissionScript(report: StartReport): string {
  const mission = report.missionControl;
  const cursor = mission.executionPlan.cursor;
  const lines = [
    '#!/usr/bin/env sh',
    'set -eu',
    '',
    scriptPrint('projscan Mission Control'),
    ...(mission.intent ? [scriptPrint(`Intent: ${mission.intent}`)] : []),
    scriptPrint(`Mode: ${report.mode}`),
    scriptPrint(`Status: ${mission.status}`),
    scriptPrint(`Current step: ${cursor.stepId} in ${cursor.phaseId}`),
    scriptPrint(''),
  ];
  if (!cursor.command) {
    lines.push(
      'printf %s\\\\n ' + shellQuoteForScript(`Blocked: ${cursor.instruction ?? cursor.label}`) + ' >&2',
      'exit 2',
    );
  } else {
    lines.push(scriptPrint('Run current command'), cursor.command);
  }
  const proofCommands = readyProofCommands(report);
  if (proofCommands.length > 0) {
    lines.push(scriptPrint(''), scriptPrint('Run remaining proof'), ...proofCommands);
  }
  lines.push(
    scriptPrint(''),
    scriptPrint('Review gate'),
    scriptPrint(mission.reviewGate.stopCondition),
    ...mission.reviewGate.commands.map((command) => scriptPrint(`Capture: ${command}`)),
  );
  return lines.join('\n') + '\n';
}
```

Keep the final code typechecked and use a dedicated single-quote escape helper for `printf` arguments.

- [ ] **Step 3: Write `mission.sh` to saved bundles**

Write `buildMissionScript(report)` to `mission.sh` in `writeMissionBundle()`, set executable mode when the filesystem allows it, add `mission.sh` to `missionBundleFiles()`, and update the quickstart file list.

- [ ] **Step 4: Add the script to shortcut discovery**

Add a `mission-script` shortcut entry before `save-mission`, with label `Mission script` and description `Print the Mission Control shell script.`

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "mission script|saved Mission Control bundle|narrower shortcut|shortcut index" --test-timeout 60000 --hook-timeout 60000
```

Expected: the new tests and shortcut-index expectations pass.

### Task 3: Update Docs And Screenshots

- [ ] **Step 1: Update docs**

Update README, GUIDE, and CHANGELOG with concise mission-script copy. Mention `mission.sh` in the saved-bundle file list.

- [ ] **Step 2: Stop-slop review**

Re-read the edited prose and cut filler, vague claims, and repeated Mission Control praise. Keep the docs direct.

- [ ] **Step 3: Update demo HTML and regenerate images**

Add `projscan start --mission-script --intent "..."` to `docs/demos/projscan-4-1-demo.html`, then run:

```bash
npm run docs:screenshots
```

Expected: exit 0.

### Task 4: Verify And Commit

- [ ] **Step 1: Run focused verification**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: exit 0 for both commands.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run lint
git diff --check
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

Expected: each command exits 0. Known plugin-trust and HuggingFace rate-limit fallback warnings are acceptable if exit code remains 0.

- [ ] **Step 3: Commit**

Commit implementation and docs with:

```bash
git add src/cli/commands/start.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md docs/demos/projscan-4-1-demo.html docs/projscan-mission-control.png docs/projscan-proof-router.png
git commit -m "feat: export mission script"
```

## Self-Review

- The plan covers every design requirement.
- The tests prove console output, bundle output, JSON precedence, and shortcut precedence.
- No step depends on release, publish, push, merge, deploy, or version bump work.
