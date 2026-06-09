# Review Gate Proof Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the remaining mission proof queue to `missionControl.reviewGate` so stop-and-review handoffs carry the proof a reviewer must inspect.

**Architecture:** Reuse the proof queue already derived for `missionControl.resume` and `missionControl.handoff.readyProof`. Add a small `reviewGate.proof` object, pass it into the review-gate builder, and render it in `reviewGate.markdown`.

**Tech Stack:** TypeScript, Vitest, Commander CLI, Markdown docs.

---

## File Structure

- Modify `src/types.ts`: add `StartMissionReviewProof` and `proof` on `StartMissionReviewGate`.
- Modify `src/core/start.ts`: derive review proof from `resume` and `proofCommands`, pass it to `buildMissionReviewGate`, and render `## Proof Queue`.
- Modify `tests/core/start.test.ts`: assert structured review proof and Markdown.
- Modify `tests/cli/start.test.ts`: assert `review-gate.md`, `handoff.json`, and `--review-gate`.
- Modify `tests/mcp/start.test.ts`: assert MCP output carries review proof and handoff review proof.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document `missionControl.reviewGate.proof`.

## Task 1: Red Tests

**Files:**
- Modify: `tests/core/start.test.ts`
- Modify: `tests/cli/start.test.ts`
- Modify: `tests/mcp/start.test.ts`

- [ ] **Step 1: Add core failing assertions**

In `start exposes a Mission Control task card for MCP and JSON clients`, after the existing worktree assertions, add:

```ts
expect(report.missionControl.reviewGate.proof).toEqual({
  summary: report.missionControl.proofSummary,
  commands: report.missionControl.resume.remainingProofCommands,
  toolCalls: report.missionControl.resume.remainingProofToolCalls,
  items: report.missionControl.resume.remainingProofItems,
});
expect(report.missionControl.reviewGate.proof.commands).not.toContain('projscan search "auth token loader" --format json');
expect(report.missionControl.reviewGate.markdown).toContain('## Proof Queue');
expect(report.missionControl.reviewGate.markdown).toContain('- `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})');
expect(report.missionControl.handoff.reviewGate.proof).toEqual(report.missionControl.reviewGate.proof);
```

- [ ] **Step 2: Add CLI failing assertions**

In `start writes a Mission Control bundle when requested`, after the existing `reviewGate` worktree assertions, add:

```ts
expect(reviewGate).toContain('## Proof Queue');
expect(reviewGate).toContain('- `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})');
```

After the existing `handoff.reviewGate.worktree.summary` assertion, add:

```ts
expect(handoff.reviewGate.proof.commands).toEqual(handoff.readyProof.commands);
expect(handoff.reviewGate.proof.items).toEqual(handoff.readyProof.items);
expect(handoff.reviewGate.proof.toolCalls).toEqual(handoff.readyProof.toolCalls);
```

In `start review-gate shortcut prints the structured review gate markdown`, add:

```ts
expect(shortcut.stdout).toContain('## Proof Queue');
expect(shortcut.stdout).toContain('- `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})');
expect(report.missionControl.reviewGate.proof.commands).toEqual(report.missionControl.resume.remainingProofCommands);
```

- [ ] **Step 3: Add MCP failing assertions**

In `projscan_start returns MCP-callable args for fuzzy impact intents`, after the existing review-gate worktree assertions, add:

```ts
expect(result.start.missionControl.reviewGate.proof.commands).toEqual(result.start.missionControl.resume.remainingProofCommands);
expect(result.start.missionControl.reviewGate.proof.toolCalls).toEqual(result.start.missionControl.resume.remainingProofToolCalls);
expect(result.start.missionControl.reviewGate.proof.items).toEqual(result.start.missionControl.resume.remainingProofItems);
expect(result.start.missionControl.reviewGate.markdown).toContain('## Proof Queue');
expect(result.start.missionControl.handoff.reviewGate.proof).toEqual(result.start.missionControl.reviewGate.proof);
```

- [ ] **Step 4: Run red tests**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "task card|Mission Control bundle|review-gate shortcut|fuzzy impact" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `reviewGate.proof` and `## Proof Queue` do not exist yet.

## Task 2: Core Implementation

**Files:**
- Modify: `src/types.ts`
- Modify: `src/core/start.ts`

- [ ] **Step 1: Add types**

In `src/types.ts`, add before `StartMissionReviewGate`:

```ts
export interface StartMissionReviewProof {
  summary: string;
  commands: string[];
  toolCalls?: StartMissionProofToolCall[];
  items?: StartMissionProofItem[];
}
```

Add to `StartMissionReviewGate`:

```ts
proof: StartMissionReviewProof;
```

- [ ] **Step 2: Pass review proof into the gate**

In `src/core/start.ts`, import `StartMissionReviewProof`.

After `const resume = missionResume(executionPlan);`, add:

```ts
const reviewProof = buildMissionReviewProof(resume, proofCommands);
```

Pass `reviewProof` into `buildMissionReviewGate`:

```ts
const reviewGate = buildMissionReviewGate({
  status,
  proof: reviewProof,
  currentWorktree: input.riskSources.currentWorktree,
});
```

Change `buildMissionReviewGate` input from `proofSummary` to `proof`:

```ts
function buildMissionReviewGate(input: {
  status: StartMissionControlStatus;
  proof: StartMissionReviewProof;
  currentWorktree: StartReport['evidence']['riskSources']['currentWorktree'];
}): StartMissionReviewGate {
```

Use `input.proof.summary` in `reviewPrompt`, return `proof: input.proof`, and pass `proof: input.proof` to the Markdown renderer.

- [ ] **Step 3: Build review proof from resume**

Add near `buildMissionReviewGate`:

```ts
function buildMissionReviewProof(
  resume: StartMissionResume,
  proofCommands: string[],
): StartMissionReviewProof {
  const commands = resume.remainingProofCommands ?? proofCommands;
  const toolCalls = resume.remainingProofToolCalls ?? [];
  const items = resume.remainingProofItems ?? [];
  return {
    summary: READY_PROOF_SUMMARY,
    commands,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(items.length > 0 ? { items } : {}),
  };
}
```

- [ ] **Step 4: Render review proof Markdown**

Add `proof: StartMissionReviewProof` to `renderMissionReviewGateMarkdown` input.

Insert `...renderMissionReviewProofLines(input.proof),` before `## Evidence Commands`.

Add:

```ts
function renderMissionReviewProofLines(proof: StartMissionReviewProof): string[] {
  const lines = ['## Proof Queue', proof.summary];
  if (proof.items && proof.items.length > 0) {
    return [...lines, ...proof.items.map(formatMissionReviewProofItem), ''];
  }
  if (proof.commands.length > 0) {
    return [...lines, ...proof.commands.map((command) => `- \`${command}\``), ''];
  }
  return [...lines, 'No proof commands are ready yet.', ''];
}

function formatMissionReviewProofItem(item: StartMissionProofItem): string {
  const annotation = item.toolCall
    ? ` (MCP: ${formatMissionReviewToolCall(item.toolCall)})`
    : ' (CLI only)';
  return `- \`${item.command}\`${annotation}`;
}

function formatMissionReviewToolCall(toolCall: StartMissionToolCall): string {
  return typeof toolCall.args !== 'undefined'
    ? `${toolCall.tool} ${JSON.stringify(toolCall.args)}`
    : toolCall.tool;
}
```

- [ ] **Step 5: Run focused core test**

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

In the Unreleased Mission Execution Plan paragraph, add one sentence near the review-gate worktree sentence:

```md
`missionControl.reviewGate.proof` carries the remaining proof queue with commands, MCP calls, and structured proof items for review-only handoffs.
```

- [ ] **Step 3: Update guide**

In the long typical agent flow paragraph, add:

```md
Use `missionControl.reviewGate.proof` when the reviewer needs the remaining proof queue without reading the full resume object.
```

- [ ] **Step 4: Update changelog**

Under Unreleased / Added, add:

```md
- Added `missionControl.reviewGate.proof`, carrying the remaining proof queue into stop-and-review handoffs.
```

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
git commit -m "feat: add proof queue to review gate"
```

Expected: one feature commit. Do not release, publish, push, deploy, or change `package.json` version.
