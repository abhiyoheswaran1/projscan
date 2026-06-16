# Review-Aware Handoff Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mission Review Gate stop and reviewer reply text to `missionControl.handoffPrompt`, `--handoff-prompt`, saved `handoff-prompt.txt`, and MCP `projscan_start` output.

**Architecture:** Build the existing `reviewGate` before the handoff prompt and pass it into `missionHandoffPrompt`. Keep `missionControl.resume.prompt` unchanged, then append a compact review section generated from `reviewGate.stopCondition` and `reviewGate.decisions`.

**Tech Stack:** TypeScript, Vitest, Commander CLI, MCP tool wrappers, Markdown docs, Playwright-backed README screenshot capture.

---

## File Structure

- Modify `src/core/start.ts`: reorder Mission Control assembly, extend `missionHandoffPrompt`, and add review prompt helper.
- Modify `tests/core/start.test.ts`: assert review-aware handoff prompt while preserving focused resume prompt.
- Modify `tests/cli/start.test.ts`: assert JSON, `--handoff-prompt`, and saved `handoff-prompt.txt`.
- Modify `tests/mcp/start.test.ts`: assert MCP `projscan_start` handoff prompt.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document the review-aware handoff prompt.
- Run `npm run docs:screenshots`; keep generated image changes only if assets differ.

## Task 1: Red Tests

**Files:**

- Modify: `tests/core/start.test.ts`
- Modify: `tests/cli/start.test.ts`
- Modify: `tests/mcp/start.test.ts`

- [ ] **Step 1: Add core assertions**

In `start report routes a plain-language intent into mission control`, after the existing ready-proof handoff prompt assertion, add:

```ts
expect(report.missionControl.handoffPrompt).toContain(
  'Review gate: Stop after the current Mission Control checklist and proof are complete.',
);
expect(report.missionControl.handoffPrompt).toContain(
  'Reviewer replies: Approve next slice => Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
);
expect(report.missionControl.handoffPrompt).toContain(
  'Request changes => Changes requested: address the review feedback first, update proof, then stop for another review.',
);
expect(report.missionControl.handoffPrompt).toContain(
  'Review version candidate => Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.',
);
expect(report.missionControl.resume.prompt).not.toContain('Review gate:');
```

In `start exposes a Mission Control task card for MCP and JSON clients`, after the existing `handoffPrompt` resume assertions, add the same `Review gate:` and `Reviewer replies:` contains checks.

- [ ] **Step 2: Add CLI assertions**

In `start JSON exposes a resume-aware handoff prompt for fuzzy intents`, add:

```ts
expect(report.missionControl.handoffPrompt).toContain(
  'Review gate: Stop after the current Mission Control checklist and proof are complete.',
);
expect(report.missionControl.handoffPrompt).toContain(
  'Reviewer replies: Approve next slice => Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
);
```

In `start prints only the concise handoff prompt when requested`, assert stdout contains the same two strings.

In `start writes a Mission Control bundle when requested`, after the existing `handoffPrompt` assertions, add:

```ts
expect(handoffPrompt).toContain(
  'Review gate: Stop after the current Mission Control checklist and proof are complete.',
);
expect(handoffPrompt).toContain(
  'Review version candidate => Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.',
);
```

- [ ] **Step 3: Add MCP assertions**

In `projscan_start returns MCP-callable args for fuzzy impact intents`, after the existing handoff prompt assertions, add:

```ts
expect(result.start.missionControl.handoffPrompt).toContain(
  'Review gate: Stop after the current Mission Control checklist and proof are complete.',
);
expect(result.start.missionControl.handoffPrompt).toContain(
  'Reviewer replies: Approve next slice => Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
);
```

- [ ] **Step 4: Run red focused tests**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "plain-language intent|resume-aware handoff prompt|handoff prompt when requested|Mission Control bundle|fuzzy impact|task card" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `missionControl.handoffPrompt` does not include review gate or reviewer reply text.

## Task 2: Core Implementation

**Files:**

- Modify: `src/core/start.ts`

- [ ] **Step 1: Move review gate before handoff prompt**

In `buildMissionControl`, replace:

```ts
const handoffPrompt = missionHandoffPrompt(resume, successCriteria, whyNow, unresolvedInputs, proofCommands);
const reviewGate = buildMissionReviewGate({
```

with:

```ts
const reviewGate = buildMissionReviewGate({
```

After the `buildMissionReviewGate` call, add:

```ts
const handoffPrompt = missionHandoffPrompt(
  resume,
  successCriteria,
  whyNow,
  unresolvedInputs,
  proofCommands,
  reviewGate,
);
```

- [ ] **Step 2: Extend the prompt signature**

Change the `missionHandoffPrompt` signature to:

```ts
function missionHandoffPrompt(
  resume: StartMissionResume,
  successCriteria: string[],
  whyNow: string,
  unresolvedInputs: StartUnresolvedInput[],
  proofCommands: string[],
  reviewGate: StartMissionReviewGate,
): string;
```

- [ ] **Step 3: Append review text**

Replace the return statement with:

```ts
return `Resume: ${trimTrailingPunctuation(resume.prompt)}. Done when: ${trimTrailingPunctuation(successCriteria[0] ?? 'The proof commands pass')}.${needsInput} Why: ${whyNow}${readyProof}${handoffReviewGatePrompt(reviewGate)}`;
```

- [ ] **Step 4: Add review prompt helper**

Add after `missionHandoffPrompt`:

```ts
function handoffReviewGatePrompt(reviewGate: StartMissionReviewGate): string {
  const decisions = reviewGate.decisions
    .map((decision) => `${decision.label} => ${decision.reply}`)
    .join('; ');
  return ` Review gate: ${trimTrailingPunctuation(reviewGate.stopCondition)}. Reviewer replies: ${decisions}.`;
}
```

- [ ] **Step 5: Run focused green tests**

Run:

```bash
npm run build
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "plain-language intent|resume-aware handoff prompt|handoff prompt when requested|Mission Control bundle|fuzzy impact|task card" --test-timeout 60000 --hook-timeout 60000
```

Expected: build and focused tests pass.

## Task 3: Docs And Screenshots

**Files:**

- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`
- Possibly modify generated screenshot assets if the capture script updates them.

- [ ] **Step 1: Update README**

In the Mission Control overview paragraph, change the handoff prompt sentence to say the concise prompt carries the review gate and reviewer replies.

- [ ] **Step 2: Update GUIDE**

In the typical agent flow paragraph, change the `missionControl.handoffPrompt` sentence to mention review gate and reviewer replies.

- [ ] **Step 3: Update CHANGELOG**

Under `Unreleased > Added`, add:

```md
- Added the Mission Review Gate stop condition and reviewer reply choices to `missionControl.handoffPrompt`, `--handoff-prompt`, and saved `handoff-prompt.txt` so copy-only handoffs keep the no-release boundary.
```

- [ ] **Step 4: Run docs screenshot capture**

Run:

```bash
npm run docs:screenshots
```

If PNGs change, inspect the changed image before committing.

## Task 4: Verification And Commit

**Files:**

- All changed files.

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

- [ ] **Step 2: Inspect final diff**

Run:

```bash
git status --short
git diff --stat
git diff -- src/core/start.ts tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
```

- [ ] **Step 3: Commit the slice**

Commit with:

```bash
git add src/core/start.ts tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts README.md docs/GUIDE.md CHANGELOG.md docs/superpowers/plans/2026-06-09-review-aware-handoff-prompt.md
git add docs
git commit -m "feat: add review gate to handoff prompt"
```

Do not release, publish, deploy, push, merge, or bump versions.

## Stop Condition

After the implementation commit is created and verification output is recorded, stop and report for human review.
