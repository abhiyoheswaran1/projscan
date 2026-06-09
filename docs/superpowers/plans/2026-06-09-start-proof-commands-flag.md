# Start Proof Commands Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `projscan start --proof-commands` shortcut that prints only ready proof commands in console mode.

**Architecture:** Keep Mission Control data unchanged. Add a CLI-only branch in `src/cli/commands/start.ts` that reuses the same ready-proof command selection used by the full console report.

**Tech Stack:** TypeScript, Commander, Vitest CLI tests.

---

### Task 1: Add Failing CLI Coverage

**Files:**
- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add proof-only console test**

Add a test that runs:

```ts
const result = await runCli([
  'start',
  '--intent',
  'what breaks if I rename the auth token loader',
  '--proof-commands',
  '--quiet',
]);
```

Assert:

```ts
expect(result.exitCode).toBe(0);
const proofCommands = result.stdout.trim().split('\n');
expect(proofCommands).toContain('projscan preflight --mode before_edit --format json');
expect(proofCommands).toContain('projscan understand --view verify --format json');
expect(proofCommands).toContain('projscan preflight --format json');
expect(proofCommands).not.toContain('projscan search "auth token loader" --format json');
expect(result.stdout).not.toContain('Start:');
expect(result.stdout).not.toContain('Mission Control');
expect(result.stdout).not.toContain('Ready Proof');
expect(result.stdout).not.toContain('Proof Queue');
```

- [ ] **Step 2: Add JSON compatibility test**

Add a test that runs:

```ts
const result = await runCli([
  'start',
  '--intent',
  'what breaks if I rename the auth token loader',
  '--proof-commands',
  '--format',
  'json',
  '--quiet',
]);
```

Parse stdout and assert:

```ts
expect(report.missionControl.handoff.readyProof.commands).toEqual(report.missionControl.resume.remainingProofCommands);
expect(report.missionControl.handoff.readyProof.commands).not.toContain('projscan search "auth token loader" --format json');
```

- [ ] **Step 3: Verify red**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: Commander rejects unknown option `--proof-commands`.

### Task 2: Implement CLI Shortcut

**Files:**
- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Register the option**

Add:

```ts
.option('--proof-commands', 'print only ready Mission Control proof commands')
```

near the other start shortcuts.

- [ ] **Step 2: Extract ready-proof command selection**

Create:

```ts
function readyProofCommands(report: StartReport): string[] {
  const mission = report.missionControl;
  return mission.handoff.readyProof.commands.length > 0
    ? mission.handoff.readyProof.commands
    : mission.proofCommands;
}
```

Use this helper in both the shortcut and `printMissionControl`.

- [ ] **Step 3: Add the console branch**

After the `--next-command` branch and before `--handoff-prompt`, add:

```ts
if (cmdOpts.proofCommands === true) {
  const commands = readyProofCommands(report);
  if (commands.length === 0) {
    console.error(chalk.red('No ready Mission Control proof commands are available.'));
    process.exit(1);
  }
  console.log(commands.join('\n'));
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

Mention `projscan start --proof-commands --intent "<goal>"` next to the existing Mission Control shortcut docs and options table.

- [ ] **Step 2: Run verification**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm run lint
git diff --check
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --proof-commands --quiet
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

- [ ] **Step 3: Commit locally**

Commit with:

```bash
git commit -m "feat: add start proof commands shortcut"
```
