# Start Handoff Prompt Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `projscan start --handoff-prompt` shortcut that prints only the concise Mission Control handoff prompt in console mode.

**Architecture:** Keep `computeStartReport` and the Mission Control model unchanged. Add a CLI-only presentation branch in `src/cli/commands/start.ts` after report computation and before JSON/full-console rendering.

**Tech Stack:** TypeScript, Commander, Vitest CLI tests.

---

### Task 1: Add Failing CLI Coverage

**Files:**

- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add prompt-only console test**

Add a test that runs:

```ts
const result = await runCli([
  'start',
  '--intent',
  'what breaks if I rename the auth token loader',
  '--handoff-prompt',
  '--quiet',
]);
```

Assert:

```ts
expect(result.exitCode).toBe(0);
expect(result.stdout.trim()).toContain(
  'Resume: Resume at ready-1 in ready_now: run `projscan search "auth token loader" --format json`.',
);
expect(result.stdout.trim()).toContain(
  'Done when: An exact symbol or file path is selected from search results before impact analysis continues.',
);
expect(result.stdout.trim()).toContain(
  'Ready proof: Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.',
);
expect(result.stdout.trim().split('\n')).toHaveLength(1);
expect(result.stdout).not.toContain('Start:');
expect(result.stdout).not.toContain('Mission Control');
expect(result.stdout).not.toContain('Agent Runbook');
expect(result.stdout).not.toContain('Ready Proof');
```

- [ ] **Step 2: Add JSON compatibility test**

Add a test that runs:

```ts
const result = await runCli([
  'start',
  '--intent',
  'what breaks if I rename the auth token loader',
  '--handoff-prompt',
  '--format',
  'json',
  '--quiet',
]);
```

Parse stdout and assert:

```ts
expect(report.missionControl.handoffPrompt).toContain(report.missionControl.resume.prompt);
expect(report.missionControl.runbook.markdown).toContain('## Handoff Prompt');
```

- [ ] **Step 3: Verify red**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: Commander rejects unknown option `--handoff-prompt`.

### Task 2: Implement CLI Shortcut

**Files:**

- Modify: `src/cli/commands/start.ts`

- [ ] **Step 1: Register the option**

Add:

```ts
.option('--handoff-prompt', 'print only the concise Mission Control handoff prompt')
```

near `--include-handoff`.

- [ ] **Step 2: Add the console branch**

After report computation and after the JSON branch, add:

```ts
if (cmdOpts.handoffPrompt === true) {
  console.log(report.missionControl.handoffPrompt);
  return;
}
```

This keeps JSON behavior unchanged and makes prompt-only output console-only.

- [ ] **Step 3: Verify green**

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

Mention `projscan start --handoff-prompt --intent "<goal>"` next to the existing Mission Control handoff docs.

- [ ] **Step 2: Run verification**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm run lint
git diff --check
node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --handoff-prompt --quiet
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

- [ ] **Step 3: Commit locally**

Commit with:

```bash
git commit -m "feat: add start handoff prompt shortcut"
```
