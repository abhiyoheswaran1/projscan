# Review Gate Worktree Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add current worktree evidence to `missionControl.reviewGate` so review handoffs include the state projscan already computed.

**Architecture:** Pass `riskSources.currentWorktree` into `buildMissionControl`, derive a small `reviewGate.worktree` object in `buildMissionReviewGate`, and render the same summary in Markdown and console output. No new Git command is added.

**Tech Stack:** TypeScript, Vitest, Commander CLI.

---

## File Structure

- Modify `src/types.ts`: add `StartMissionReviewWorktree` and `worktree` on `StartMissionReviewGate`.
- Modify `src/core/start.ts`: pass risk sources into Mission Control, derive worktree summary, render Markdown section.
- Modify `src/cli/commands/start.ts`: print `reviewGate.worktree.summary` in default console review gate.
- Modify `tests/core/start.test.ts`: assert structured worktree evidence and Markdown.
- Modify `tests/cli/start.test.ts`: assert shortcut, bundle file, and console output.
- Modify `tests/mcp/start.test.ts`: assert MCP output carries worktree evidence through review gate and handoff.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document the new structured evidence.

## Task 1: Red Tests

**Files:**
- Modify: `tests/core/start.test.ts`
- Modify: `tests/cli/start.test.ts`
- Modify: `tests/mcp/start.test.ts`

- [ ] **Step 1: Add core failing assertions**

In `start exposes a Mission Control task card for MCP and JSON clients`, add:

```ts
expect(report.missionControl.reviewGate.worktree).toEqual(
  expect.objectContaining({
    available: false,
    clean: false,
    changedFileCount: 0,
    files: [],
    baseRef: null,
    summary: 'Current worktree evidence is unavailable: not a git repository.',
    reason: 'not a git repository',
  }),
);
expect(report.missionControl.reviewGate.markdown).toContain('## Worktree Evidence');
expect(report.missionControl.reviewGate.markdown).toContain('Current worktree evidence is unavailable: not a git repository.');
expect(report.missionControl.handoff.reviewGate.worktree).toEqual(report.missionControl.reviewGate.worktree);
```

- [ ] **Step 2: Add CLI failing assertions**

In `start console renders a concrete action plan for fuzzy impact intents`, add:

```ts
expect(result.stdout).toContain('Current worktree evidence');
```

In `start writes a Mission Control bundle when requested`, after reading `review-gate.md`, add:

```ts
expect(reviewGate).toContain('## Worktree Evidence');
expect(reviewGate).toContain('Current worktree evidence');
expect(handoff.reviewGate.worktree.summary).toContain('Current worktree evidence');
```

In `start review-gate shortcut prints the structured review gate markdown`, add:

```ts
expect(shortcut.stdout).toContain('## Worktree Evidence');
expect(shortcut.stdout).toContain(report.missionControl.reviewGate.worktree.summary);
```

- [ ] **Step 3: Add MCP failing assertion**

In `projscan_start returns MCP-callable args for fuzzy impact intents`, add:

```ts
expect(result.start.missionControl.reviewGate.worktree.summary).toContain('Current worktree evidence');
expect(result.start.missionControl.handoff.reviewGate.worktree).toEqual(result.start.missionControl.reviewGate.worktree);
```

- [ ] **Step 4: Run red tests**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "task card|fuzzy impact|review-gate shortcut|Mission Control bundle" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `reviewGate.worktree` and Markdown worktree evidence do not exist.

## Task 2: Core Implementation

**Files:**
- Modify: `src/types.ts`
- Modify: `src/core/start.ts`

- [ ] **Step 1: Add types**

Add before `StartMissionReviewGate`:

```ts
export interface StartMissionReviewWorktree {
  available: boolean;
  clean: boolean;
  changedFileCount: number;
  files: string[];
  baseRef: string | null;
  summary: string;
  reason?: string;
}
```

Add to `StartMissionReviewGate`:

```ts
worktree: StartMissionReviewWorktree;
```

- [ ] **Step 2: Pass risk sources into Mission Control**

Add to `buildMissionControl` input:

```ts
riskSources: StartReport['evidence']['riskSources'];
```

Pass from `computeStartReport`:

```ts
riskSources,
```

Pass into `buildMissionReviewGate`:

```ts
currentWorktree: input.riskSources.currentWorktree,
```

- [ ] **Step 3: Build worktree evidence**

Add:

```ts
function buildMissionReviewWorktree(
  currentWorktree: StartReport['evidence']['riskSources']['currentWorktree'],
): StartMissionReviewWorktree {
  if (!currentWorktree.available) {
    const reason = currentWorktree.reason ?? 'unknown';
    return {
      available: false,
      clean: false,
      changedFileCount: 0,
      files: [],
      baseRef: currentWorktree.baseRef,
      reason,
      summary: `Current worktree evidence is unavailable: ${reason}.`,
    };
  }
  const changedFileCount = currentWorktree.count;
  const baseRef = currentWorktree.baseRef;
  return {
    available: true,
    clean: changedFileCount === 0,
    changedFileCount,
    files: currentWorktree.files,
    baseRef,
    summary: changedFileCount === 0
      ? 'Current worktree evidence sees no changed files.'
      : `Current worktree evidence sees ${changedFileCount} changed file(s)${baseRef ? ` against ${baseRef}` : ''}.`,
  };
}
```

- [ ] **Step 4: Render Markdown**

Add `worktree` to `renderMissionReviewGateMarkdown` input and insert before `## Review Prompt`:

```ts
'## Worktree Evidence',
input.worktree.summary,
...input.worktree.files.slice(0, 8).map((file) => `- \`${file}\``),
'',
```

- [ ] **Step 5: Run focused core test**

Run:

```bash
npm run build && npx vitest run tests/core/start.test.ts --testNamePattern "task card" --test-timeout 60000 --hook-timeout 60000
```

Expected: build passes and focused core test passes.

## Task 3: CLI and Docs

**Files:**
- Modify: `src/cli/commands/start.ts`
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Print worktree summary in default console**

In `printReviewGate`, after commands, add:

```ts
console.log(gate.worktree.summary);
```

- [ ] **Step 2: Update docs**

Document that `missionControl.reviewGate.worktree` carries the current worktree evidence summary and visible file list.

- [ ] **Step 3: Run focused CLI/MCP tests**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "fuzzy impact|review-gate shortcut|Mission Control bundle" --test-timeout 60000 --hook-timeout 60000
```

Expected: build passes and focused tests pass.

## Task 4: Verification and Commit

**Files:**
- All modified files

- [ ] **Step 1: Run verification**

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

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add src/types.ts src/core/start.ts src/cli/commands/start.ts tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
git commit -m "feat: add worktree evidence to review gate"
```

Expected: one feature commit. Do not release, publish, push, deploy, or change `package.json` version.
