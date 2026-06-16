# Handoff-Visible Review Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Mission Control review gate visible in default console output and structured handoff JSON.

**Architecture:** Keep `missionControl.reviewGate` as the source of truth. Add that same object to `missionControl.handoff.reviewGate`, print a compact console section from it, and document that `--handoff-json` carries the stop boundary.

**Tech Stack:** TypeScript, Commander CLI, Vitest.

---

## File Structure

- Modify `src/types.ts`: add `reviewGate: StartMissionReviewGate` to `StartMissionHandoff`.
- Modify `src/core/start.ts`: pass the existing `reviewGate` into `missionHandoff` and return it in the handoff object.
- Modify `src/cli/commands/start.ts`: print a compact `Review Gate` section in default console output.
- Modify `tests/core/start.test.ts`: assert `handoff.reviewGate` equals `reviewGate`.
- Modify `tests/cli/start.test.ts`: assert default console, `--handoff-json`, and bundle `handoff.json` include the gate.
- Modify `tests/mcp/start.test.ts`: assert MCP handoff includes the gate.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document that the complete handoff object carries the review gate.

## Task 1: Red Tests

**Files:**

- Modify: `tests/core/start.test.ts`
- Modify: `tests/cli/start.test.ts`
- Modify: `tests/mcp/start.test.ts`

- [ ] **Step 1: Add core failing assertion**

In `start exposes a Mission Control task card for MCP and JSON clients`, add:

```ts
expect(report.missionControl.handoff.reviewGate).toEqual(report.missionControl.reviewGate);
```

- [ ] **Step 2: Add CLI failing assertions**

In `start console renders a concrete action plan for fuzzy impact intents`, add:

```ts
expect(result.stdout).toContain('Review Gate');
expect(result.stdout).toContain(
  'Stop after the current Mission Control checklist and proof are complete.',
);
expect(result.stdout).toContain('- git status --short');
expect(result.stdout).toContain('- git diff --stat');
expect(result.stdout).toContain(
  'Stop and ask for approval before starting another slice, release, publish, or deploy.',
);
```

In `start prints only the handoff object as compact JSON when requested`, add:

```ts
expect(handoff.reviewGate).toEqual(
  expect.objectContaining({
    title: 'Mission Review Gate',
    commands: ['git status --short', 'git diff --stat'],
  }),
);
```

In `start writes a Mission Control bundle when requested`, after parsing `handoff.json`, add:

```ts
expect(handoff.reviewGate).toEqual(
  expect.objectContaining({
    title: 'Mission Review Gate',
    commands: ['git status --short', 'git diff --stat'],
  }),
);
```

- [ ] **Step 3: Add MCP failing assertion**

In `projscan_start returns MCP-callable args for fuzzy impact intents`, add:

```ts
expect(result.start.missionControl.handoff.reviewGate).toEqual(
  result.start.missionControl.reviewGate,
);
```

- [ ] **Step 4: Run red tests**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "task card|fuzzy impact|handoff object|Mission Control bundle" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `handoff.reviewGate` and default console `Review Gate` do not exist yet.

## Task 2: Core Handoff

**Files:**

- Modify: `src/types.ts`
- Modify: `src/core/start.ts`

- [ ] **Step 1: Extend handoff type**

Add to `StartMissionHandoff`:

```ts
reviewGate: StartMissionReviewGate;
```

- [ ] **Step 2: Pass the gate into `missionHandoff`**

Change the call:

```ts
handoff: missionHandoff(
  executionPlan.cursor,
  resume,
  primaryAction,
  readyActions,
  unresolvedInputs,
  successCriteria,
  proofCommands,
  reviewGate,
),
```

Update the function signature:

```ts
function missionHandoff(
  cursor: StartExecutionCursor,
  resume: StartMissionResume,
  primaryAction: PreflightSuggestedAction,
  readyActions: PreflightSuggestedAction[],
  unresolvedInputs: StartUnresolvedInput[],
  successCriteria: string[],
  proofCommands: string[],
  reviewGate: StartMissionReviewGate,
): StartMissionHandoff;
```

Return:

```ts
reviewGate,
```

- [ ] **Step 3: Run focused core test**

Run:

```bash
npm run build && npx vitest run tests/core/start.test.ts --testNamePattern "task card" --test-timeout 60000 --hook-timeout 60000
```

Expected: build passes and focused core test passes.

## Task 3: Console Output

**Files:**

- Modify: `src/cli/commands/start.ts`
- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add compact console renderer**

Add this helper near `printHandoffPrompt`:

```ts
function printReviewGate(report: StartReport): void {
  const gate = report.missionControl.reviewGate;
  console.log(chalk.bold('Review Gate'));
  console.log(gate.stopCondition);
  for (const command of gate.commands) console.log(`- ${command}`);
  const stopLine = gate.checklist.find((item) => item.startsWith('Stop and ask'));
  if (stopLine) console.log(chalk.dim(stopLine));
}
```

Call it after `printHandoffPrompt(report);` in `printMissionControl`.

- [ ] **Step 2: Run focused CLI/MCP tests**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "fuzzy impact|handoff object|Mission Control bundle" --test-timeout 60000 --hook-timeout 60000
```

Expected: build passes and focused CLI/MCP tests pass.

## Task 4: Docs and Verification

**Files:**

- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update docs**

Document that `missionControl.handoff.reviewGate` and `--handoff-json` include the same review gate as `missionControl.reviewGate`.

- [ ] **Step 2: Run verification**

Run:

```bash
npm run build
npm run lint
git diff --check
npx vitest run tests/cli/start.test.ts tests/core/start.test.ts tests/mcp/start.test.ts --test-timeout 60000 --hook-timeout 60000
npm test
npm run check:stability
npm run security:release-gate
npm run check:graph-corpus
npm run smoke:packed-install
```

Expected: all commands exit 0. Known semantic-model 429 and untrusted sample-plugin warnings are acceptable only when the command exits 0.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add src/types.ts src/core/start.ts src/cli/commands/start.ts tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
git commit -m "feat: carry review gate in mission handoff"
```

Expected: one feature commit. Do not release, publish, push, deploy, or change `package.json` version.
