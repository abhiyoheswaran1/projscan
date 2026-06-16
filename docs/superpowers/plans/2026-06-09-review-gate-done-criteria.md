# Review Gate Done Criteria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add mission done criteria to `missionControl.reviewGate` so stop-and-review artifacts show what must be true before approval.

**Architecture:** Reuse `missionControl.successCriteria` as the source of truth. Pass it into `buildMissionReviewGate`, store it as `reviewGate.doneWhen`, and render a `## Done When` section in review-gate Markdown.

**Tech Stack:** TypeScript, Vitest, Commander CLI, Markdown docs.

---

## File Structure

- Modify `src/types.ts`: add `doneWhen: string[]` to `StartMissionReviewGate`.
- Modify `src/core/start.ts`: pass `successCriteria` to `buildMissionReviewGate`, copy it into the gate, and render `## Done When`.
- Modify `tests/core/start.test.ts`: assert structured done criteria and Markdown.
- Modify `tests/cli/start.test.ts`: assert saved `review-gate.md`, `handoff.json`, and `--review-gate`.
- Modify `tests/mcp/start.test.ts`: assert MCP output carries done criteria through review gate and handoff review gate.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document `missionControl.reviewGate.doneWhen`.

## Task 1: Red Tests

**Files:**

- Modify: `tests/core/start.test.ts`
- Modify: `tests/cli/start.test.ts`
- Modify: `tests/mcp/start.test.ts`

- [ ] **Step 1: Add core failing assertions**

In `start exposes a Mission Control task card for MCP and JSON clients`, after the existing `reviewGate.proof` assertions, add:

```ts
expect(report.missionControl.reviewGate.doneWhen).toEqual(report.missionControl.successCriteria);
expect(report.missionControl.reviewGate.markdown).toContain('## Done When');
expect(report.missionControl.reviewGate.markdown).toContain(
  '- [ ] An exact symbol or file path is selected from search results before impact analysis continues.',
);
expect(report.missionControl.handoff.reviewGate.doneWhen).toEqual(
  report.missionControl.reviewGate.doneWhen,
);
```

- [ ] **Step 2: Add CLI failing assertions**

In `start writes a Mission Control bundle when requested`, after the existing review-gate proof assertions, add:

```ts
expect(reviewGate).toContain('## Done When');
expect(reviewGate).toContain(
  '- [ ] An exact symbol or file path is selected from search results before impact analysis continues.',
);
```

After the existing `handoff.reviewGate.proof.toolCalls` assertion, add:

```ts
expect(handoff.reviewGate.doneWhen).toEqual(handoff.doneWhen);
```

In `start review-gate shortcut prints the structured review gate markdown`, add:

```ts
expect(shortcut.stdout).toContain('## Done When');
expect(shortcut.stdout).toContain(
  '- [ ] An exact symbol or file path is selected from search results before impact analysis continues.',
);
expect(report.missionControl.reviewGate.doneWhen).toEqual(report.missionControl.successCriteria);
```

- [ ] **Step 3: Add MCP failing assertions**

In `projscan_start returns MCP-callable args for fuzzy impact intents`, after the existing `reviewGate.proof` assertions, add:

```ts
expect(result.start.missionControl.reviewGate.doneWhen).toEqual(
  result.start.missionControl.successCriteria,
);
expect(result.start.missionControl.reviewGate.markdown).toContain('## Done When');
expect(result.start.missionControl.handoff.reviewGate.doneWhen).toEqual(
  result.start.missionControl.reviewGate.doneWhen,
);
```

- [ ] **Step 4: Run red tests**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "task card|Mission Control bundle|review-gate shortcut|fuzzy impact" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `reviewGate.doneWhen` and `## Done When` do not exist yet.

## Task 2: Core Implementation

**Files:**

- Modify: `src/types.ts`
- Modify: `src/core/start.ts`

- [ ] **Step 1: Add type field**

In `src/types.ts`, add to `StartMissionReviewGate` after `checklist`:

```ts
doneWhen: string[];
```

- [ ] **Step 2: Pass success criteria into review gate**

In `src/core/start.ts`, update the `buildMissionReviewGate` call:

```ts
const reviewGate = buildMissionReviewGate({
  status,
  doneWhen: successCriteria,
  proof: reviewProof,
  currentWorktree: input.riskSources.currentWorktree,
});
```

Update the function input:

```ts
function buildMissionReviewGate(input: {
  status: StartMissionControlStatus;
  doneWhen: string[];
  proof: StartMissionReviewProof;
  currentWorktree: StartReport['evidence']['riskSources']['currentWorktree'];
}): StartMissionReviewGate {
```

Inside the function, add:

```ts
const doneWhen = input.doneWhen.slice();
```

Return `doneWhen` and pass it to the Markdown renderer.

- [ ] **Step 3: Render done criteria in Markdown**

Add `doneWhen: string[]` to `renderMissionReviewGateMarkdown` input.

Insert after the checklist section and before `renderMissionReviewProofLines`:

```ts
'## Done When',
...(input.doneWhen.length > 0
  ? input.doneWhen.map((criterion) => `- [ ] ${criterion}`)
  : ['- [ ] The current mission is complete and verified.']),
'',
```

- [ ] **Step 4: Run focused core test**

Run:

```bash
npm run build && npx vitest run tests/core/start.test.ts --testNamePattern "task card" --test-timeout 60000 --hook-timeout 60000
```

Expected: build passes and focused core test passes.

## Task 3: CLI, MCP, and Docs

**Files:**

- Modify: `tests/cli/start.test.ts`
- Modify: `tests/mcp/start.test.ts`
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run focused CLI/MCP tests**

Run:

```bash
npm run build && npx vitest run tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "Mission Control bundle|review-gate shortcut|fuzzy impact" --test-timeout 60000 --hook-timeout 60000
```

Expected: build passes and focused CLI/MCP tests pass.

- [ ] **Step 2: Update README**

In the Unreleased Mission Execution Plan paragraph, add one sentence near the existing review-gate sentences:

```md
`missionControl.reviewGate.doneWhen` mirrors the mission success criteria, so review-only handoffs show the approval target beside proof and worktree evidence.
```

- [ ] **Step 3: Update guide**

In the long typical agent flow paragraph, add:

```md
Read `missionControl.reviewGate.doneWhen` for the success criteria the reviewer must confirm before approving more work.
```

- [ ] **Step 4: Update changelog**

Under Unreleased / Added, add:

```md
- Added `missionControl.reviewGate.doneWhen`, carrying mission success criteria into stop-and-review handoffs.
```

- [ ] **Step 5: Regenerate README screenshots**

Run:

```bash
npm run docs:screenshots
```

Expected: exits 0. Include screenshot diffs only if the capture source or PNG output changes.

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
git add src/types.ts src/core/start.ts tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
git commit -m "feat: add done criteria to review gate"
```

Expected: one feature commit. Do not release, publish, push, deploy, or change `package.json` version.
