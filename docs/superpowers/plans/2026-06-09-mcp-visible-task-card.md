# MCP-Visible Task Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the Mission Task Card in `missionControl.taskCard` so MCP and JSON clients receive the same Markdown artifact as CLI users.

**Architecture:** Move task-card rendering from `src/cli/commands/start.ts` to `src/core/start.ts`. Add a small `StartMissionTaskCard` type and populate it inside `buildMissionControl`; CLI shortcuts and saved bundles then read `report.missionControl.taskCard.markdown`.

**Tech Stack:** TypeScript, Vitest, Commander CLI, MCP tool wrapper, Playwright-backed docs screenshots.

---

## File Structure

- Modify `src/types.ts`: add `StartMissionTaskCard` and `taskCard` on `StartMissionControl`.
- Modify `src/core/start.ts`: build `missionControl.taskCard` from existing resume, handoff proof, success criteria, and handoff prompt.
- Modify `src/cli/commands/start.ts`: remove local task-card renderer helpers and use `report.missionControl.taskCard.markdown`.
- Modify `tests/core/start.test.ts`: assert the core report exposes task card metadata and Markdown.
- Modify `tests/mcp/start.test.ts`: assert MCP `projscan_start` includes task card Markdown.
- Modify `tests/cli/start.test.ts`: assert `--task-card` and saved `task-card.md` match the JSON/core task card.
- Modify `README.md`, `docs/GUIDE.md`, `CHANGELOG.md`: document `missionControl.taskCard.markdown`.
- Run `npm run docs:screenshots` only if README demo copy changes.

---

### Task 1: Red Tests For Core And MCP Payload

**Files:**
- Modify: `tests/core/start.test.ts`
- Modify: `tests/mcp/start.test.ts`

- [ ] **Step 1: Add the core failing test**

Near the Mission Control resume/runbook tests in `tests/core/start.test.ts`, add:

```ts
test('start exposes a Mission Control task card for MCP and JSON clients', async () => {
  const report = await computeStartReport(root, {
    intent: 'what breaks if I rename the auth token loader',
  });

  expect(report.missionControl.taskCard).toEqual(
    expect.objectContaining({
      title: 'Mission Task Card',
      status: report.missionControl.status,
      currentPhase: report.missionControl.executionPlan.cursor.phaseId,
      currentStep: report.missionControl.executionPlan.cursor,
    }),
  );
  expect(report.missionControl.taskCard.markdown.startsWith('# Mission Task Card\n')).toBe(true);
  expect(report.missionControl.taskCard.markdown).toContain('Intent: what breaks if I rename the auth token loader');
  expect(report.missionControl.taskCard.markdown).toContain('- [ ] Run `projscan search "auth token loader" --format json`');
  expect(report.missionControl.taskCard.markdown).toContain('- [ ] After inputs, run `projscan impact --symbol <symbol-from-search> --format json`');
  expect(report.missionControl.taskCard.markdown).toContain('## Proof');
  expect(report.missionControl.taskCard.markdown).toContain('- [ ] `projscan preflight --mode before_edit --format json`');
  expect(report.missionControl.taskCard.markdown).toContain('## Done When');
  expect(report.missionControl.taskCard.markdown).toContain(report.missionControl.handoffPrompt);
  expect(report.missionControl.taskCard.markdown.endsWith('\n')).toBe(true);
});
```

- [ ] **Step 2: Add the MCP failing assertion**

In the MCP Mission Control test for fuzzy impact intents in `tests/mcp/start.test.ts`, add:

```ts
expect(result.start.missionControl.taskCard.markdown).toContain('# Mission Task Card');
expect(result.start.missionControl.taskCard.markdown).toContain('After inputs, run `projscan impact --symbol <symbol-from-search> --format json`');
expect(result.start.missionControl.taskCard.currentStep).toEqual(result.start.missionControl.executionPlan.cursor);
```

- [ ] **Step 3: Run the red tests**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/mcp/start.test.ts --testNamePattern "task card|fuzzy impact" --test-timeout 60000 --hook-timeout 60000
```

Expected: FAIL because `missionControl.taskCard` does not exist.

---

### Task 2: Add Types And Core Renderer

**Files:**
- Modify: `src/types.ts`
- Modify: `src/core/start.ts`

- [ ] **Step 1: Add the public type**

In `src/types.ts`, add after `StartMissionRunbook`:

```ts
export interface StartMissionTaskCard {
  title: string;
  status: StartMissionControlStatus;
  currentPhase: StartExecutionPhaseId;
  currentStep: StartExecutionCursor;
  markdown: string;
}
```

Add to `StartMissionControl`:

```ts
taskCard: StartMissionTaskCard;
```

- [ ] **Step 2: Import the type in core**

Add `StartMissionTaskCard` to the type imports in `src/core/start.ts`.

- [ ] **Step 3: Build the task card in Mission Control**

In `buildMissionControl`, after `runbook` is built, add:

```ts
const taskCard = buildMissionTaskCard({
  intent: input.intent,
  status,
  currentStep: executionPlan.cursor,
  resume,
  successCriteria,
  handoffPrompt,
});
```

Return `taskCard` in the Mission Control object.

- [ ] **Step 4: Add the core renderer helpers**

Add these helpers near the runbook renderer in `src/core/start.ts`:

```ts
function buildMissionTaskCard(input: {
  intent?: string;
  status: StartMissionControlStatus;
  currentStep: StartExecutionCursor;
  resume: StartMissionResume;
  successCriteria: string[];
  handoffPrompt: string;
}): StartMissionTaskCard {
  return {
    title: 'Mission Task Card',
    status: input.status,
    currentPhase: input.currentStep.phaseId,
    currentStep: input.currentStep,
    markdown: renderMissionTaskCardMarkdown(input),
  };
}

function renderMissionTaskCardMarkdown(input: {
  intent?: string;
  status: StartMissionControlStatus;
  currentStep: StartExecutionCursor;
  resume: StartMissionResume;
  successCriteria: string[];
  handoffPrompt: string;
}): string {
  const lines = [
    '# Mission Task Card',
    '',
    ...(input.intent ? [`Intent: ${input.intent}`] : []),
    `Status: ${input.status}`,
    `Current step: ${input.currentStep.stepId} in ${input.currentStep.phaseId}`,
    '',
    '## Do Next',
    ...missionTaskCardActionLines(input.resume),
    '',
    '## Proof',
    ...missionTaskCardProofLines(input.resume),
    '',
    '## Done When',
    ...(input.successCriteria.length > 0
      ? input.successCriteria.map((criterion) => `- [ ] ${criterion}`)
      : ['- [ ] The next action is complete and verified.']),
    '',
    '## Handoff Prompt',
    input.handoffPrompt,
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}
```

Add formatters equivalent to the current CLI helpers:

```ts
function missionTaskCardActionLines(resume: StartMissionResume): string[] {
  const checklist = resume.checklist ?? [];
  const actionLines = checklist
    .filter((item) => item.kind !== 'run_proof' && item.kind !== 'confirm_done')
    .map(formatTaskCardChecklistItem);
  return actionLines.length > 0 ? actionLines : ['- [ ] Continue from the current Mission Control cursor.'];
}

function missionTaskCardProofLines(resume: StartMissionResume): string[] {
  const proofItems = resume.remainingProofItems ?? [];
  const proofLines = proofItems.map(formatTaskCardProofItem);
  if (proofLines.length > 0) return proofLines;
  const commands = resume.remainingProofCommands ?? [];
  return commands.length > 0
    ? commands.map((command) => `- [ ] \`${command}\``)
    : ['- [ ] No proof commands are ready yet.'];
}
```

Use the same checklist/proof/tool-call formatters from the CLI implementation.

- [ ] **Step 5: Run green core/MCP tests**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/mcp/start.test.ts --testNamePattern "task card|fuzzy impact" --test-timeout 60000 --hook-timeout 60000
```

Expected: PASS.

---

### Task 3: Reuse Core Task Card In CLI And Bundle

**Files:**
- Modify: `src/cli/commands/start.ts`
- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add CLI equality assertions**

In `tests/cli/start.test.ts`, add a JSON shortcut test:

```ts
test('start JSON exposes the same task card used by the CLI shortcut', async () => {
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
    '--intent',
    'what breaks if I rename the auth token loader',
    '--task-card',
    '--quiet',
  ]);

  expect(json.exitCode).toBe(0);
  expect(shortcut.exitCode).toBe(0);
  const report = JSON.parse(json.stdout);
  expect(shortcut.stdout).toBe(report.missionControl.taskCard.markdown);
});
```

In the saved bundle test, after reading `taskCard`, add:

```ts
const bundleReport = JSON.parse((await runCli([
  'start',
  '--intent',
  'what breaks if I rename the auth token loader',
  '--format',
  'json',
  '--quiet',
])).stdout);
expect(taskCard).toBe(bundleReport.missionControl.taskCard.markdown);
```

- [ ] **Step 2: Run red CLI equality test if source still uses local renderer**

Run:

```bash
npx vitest run tests/cli/start.test.ts --testNamePattern "same task card|Mission Control bundle|mission task card" --test-timeout 60000 --hook-timeout 60000
```

Expected before CLI refactor: may FAIL if the JSON field is absent in built dist or if the local renderer diverges.

- [ ] **Step 3: Simplify CLI implementation**

In `src/cli/commands/start.ts`:

- Change `writeMissionBundle` to write `report.missionControl.taskCard.markdown`.
- Change `printTaskCardOnly` to read `report.missionControl.taskCard.markdown`.
- Delete local helpers `renderMissionTaskCard`, `missionTaskCardActionLines`, `missionTaskCardProofLines`, `formatTaskCardChecklistItem`, `formatTaskCardChecklistAnnotation`, `formatTaskCardProofItem`, and `formatTaskCardToolCall`.
- Remove now-unused type imports `StartMissionProofItem` and `StartMissionResumeChecklistItem` if TypeScript reports them unused.

- [ ] **Step 4: Build and run CLI green tests**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts --testNamePattern "same task card|Mission Control bundle|mission task card" --test-timeout 60000 --hook-timeout 60000
```

Expected: PASS.

---

### Task 4: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`
- Regenerate screenshots only if demo copy changes.

- [ ] **Step 1: Update README**

In the Unreleased Mission Control section, change the task-card paragraph to mention:

```md
MCP and JSON clients also receive `missionControl.taskCard.markdown`, the same Markdown printed by `--task-card` and written to `task-card.md`.
```

- [ ] **Step 2: Update GUIDE**

In the `projscan_start` agent-flow text or shortcut paragraph, add:

```md
MCP agents can read `missionControl.taskCard.markdown` when they need the paste-ready checklist without rendering one from `resume.checklist`.
```

- [ ] **Step 3: Update CHANGELOG**

Under Unreleased Added, add:

```md
- Added `missionControl.taskCard`, exposing the paste-ready Mission Task Card Markdown to JSON and MCP clients.
```

- [ ] **Step 4: Verification**

Run:

```bash
npm run build
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm run lint
git diff --check
tmpdir=$(mktemp -d); node dist/cli/index.js start --intent "what breaks if I rename the auth token loader" --format json --quiet > "$tmpdir/start.json"; node -e 'const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if (!r.missionControl.taskCard.markdown.includes("# Mission Task Card")) process.exit(1);' "$tmpdir/start.json"; rm -rf "$tmpdir"
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/types.ts src/core/start.ts src/cli/commands/start.ts tests/core/start.test.ts tests/mcp/start.test.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
git commit -m "feat: expose mission task card in start report"
```

Expected: commit succeeds and `git status --short` is clean.

---

## Plan Self-Review

- Spec coverage: `missionControl.taskCard`, core rendering, MCP visibility, CLI reuse, docs, and gates all have tasks.
- Placeholder scan: no `TBD`, `TODO`, or vague implementation steps remain.
- Type consistency: `StartMissionTaskCard` uses existing Mission Control status, phase, and cursor types.
