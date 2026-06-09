# Structured Review Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a machine-readable Mission Review Gate policy that tells JSON and MCP clients which actions are blocked until reviewer approval.

**Architecture:** Add a typed `policy` object to `StartMissionReviewGate`, build it in `buildMissionReviewGate()`, and pass it through Markdown rendering. Keep decision ids and reply text unchanged; this is an additive policy field over the existing review gate.

**Tech Stack:** TypeScript, Vitest, Commander CLI, MCP start tool, Markdown docs, Playwright-backed README screenshot capture.

---

## File Structure

- Modify `src/types.ts`: add `StartMissionReviewBlockedAction`, `StartMissionReviewPolicy`, and `StartMissionReviewGate.policy`.
- Modify `src/core/start.ts`: build the fixed policy, return it from `buildMissionReviewGate()`, and render a `## Review Policy` Markdown section.
- Modify `tests/core/start.test.ts`: assert the policy object and Markdown.
- Modify `tests/mcp/start.test.ts`: assert the MCP JSON policy.
- Modify `tests/cli/start.test.ts`: assert `--review-gate` and saved `review-gate.md` contain the policy section.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document the structured policy.
- Run `npm run docs:screenshots`; keep generated image changes only if the screenshots differ.

## Task 1: Red Tests

**Files:**
- Modify: `tests/core/start.test.ts`
- Modify: `tests/mcp/start.test.ts`
- Modify: `tests/cli/start.test.ts`

- [ ] **Step 1: Add core policy expectations**

In `start exposes a Mission Control task card for MCP and JSON clients`, after the existing `reviewGate.commands` expectation, add:

```ts
expect(report.missionControl.reviewGate.policy).toEqual({
  approvalRequired: true,
  blockedActions: ['next_slice', 'release', 'publish', 'deploy', 'push', 'merge', 'version_bump'],
  summary: 'Explicit reviewer approval is required before another slice, release, publish, deploy, push, merge, or version bump.',
});
expect(report.missionControl.reviewGate.markdown).toContain('## Review Policy');
expect(report.missionControl.reviewGate.markdown).toContain('- Start another implementation slice (`next_slice`)');
expect(report.missionControl.reviewGate.markdown).toContain('- Version bump (`version_bump`)');
```

After the existing `handoff.reviewGate.decisions` expectation, add:

```ts
expect(report.missionControl.handoff.reviewGate.policy).toEqual(report.missionControl.reviewGate.policy);
```

- [ ] **Step 2: Add MCP policy expectations**

In `projscan_start returns MCP-callable args for fuzzy impact intents`, after the existing review-gate object expectation, add:

```ts
expect(result.start.missionControl.reviewGate.policy).toEqual({
  approvalRequired: true,
  blockedActions: ['next_slice', 'release', 'publish', 'deploy', 'push', 'merge', 'version_bump'],
  summary: 'Explicit reviewer approval is required before another slice, release, publish, deploy, push, merge, or version bump.',
});
expect(result.start.missionControl.reviewGate.markdown).toContain('## Review Policy');
expect(result.start.missionControl.handoff.reviewGate.policy).toEqual(
  result.start.missionControl.reviewGate.policy,
);
```

- [ ] **Step 3: Add CLI Markdown expectations**

In `start writes a Mission Control bundle when requested`, after the existing `reviewGate` Markdown assertions, add:

```ts
expect(reviewGate).toContain('## Review Policy');
expect(reviewGate).toContain('Approval required: yes');
expect(reviewGate).toContain('- Push (`push`)');
expect(reviewGate).toContain('- Version bump (`version_bump`)');
```

In `start review-gate shortcut prints the structured review gate markdown`, add the same section assertions against `shortcut.stdout`.

- [ ] **Step 4: Run red tests**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/mcp/start.test.ts tests/cli/start.test.ts --testNamePattern "task card|fuzzy impact|Mission Control bundle|review-gate shortcut" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `reviewGate.policy` and the Markdown section do not exist yet.

## Task 2: Core Types And Policy Builder

**Files:**
- Modify: `src/types.ts`
- Modify: `src/core/start.ts`

- [ ] **Step 1: Add types**

In `src/types.ts`, before `StartMissionReviewWorktree`, add:

```ts
export type StartMissionReviewBlockedAction =
  | 'next_slice'
  | 'release'
  | 'publish'
  | 'deploy'
  | 'push'
  | 'merge'
  | 'version_bump';

export interface StartMissionReviewPolicy {
  approvalRequired: true;
  blockedActions: StartMissionReviewBlockedAction[];
  summary: string;
}
```

Add this field to `StartMissionReviewGate`:

```ts
policy: StartMissionReviewPolicy;
```

- [ ] **Step 2: Import the new type**

In `src/core/start.ts`, add `StartMissionReviewPolicy` to the existing type import list from `../types.js`.

- [ ] **Step 3: Build the fixed policy**

Add near `buildMissionReviewGate()`:

```ts
function buildMissionReviewPolicy(): StartMissionReviewPolicy {
  return {
    approvalRequired: true,
    blockedActions: ['next_slice', 'release', 'publish', 'deploy', 'push', 'merge', 'version_bump'],
    summary: 'Explicit reviewer approval is required before another slice, release, publish, deploy, push, merge, or version bump.',
  };
}
```

- [ ] **Step 4: Attach policy to the review gate**

In `buildMissionReviewGate()`, create:

```ts
const policy = buildMissionReviewPolicy();
```

Return `policy`, and pass it into `renderMissionReviewGateMarkdown()`.

## Task 3: Markdown Rendering

**Files:**
- Modify: `src/core/start.ts`

- [ ] **Step 1: Extend renderer input**

Add `policy: StartMissionReviewPolicy;` to the `renderMissionReviewGateMarkdown()` input type.

- [ ] **Step 2: Render policy after checklist**

After the checklist block in `renderMissionReviewGateMarkdown()`, add:

```ts
'## Review Policy',
`Approval required: ${input.policy.approvalRequired ? 'yes' : 'no'}`,
input.policy.summary,
'Blocked until approval:',
...input.policy.blockedActions.map(formatMissionReviewBlockedAction),
'',
```

- [ ] **Step 3: Add blocked-action labels**

Add after `formatMissionReviewDecision()`:

```ts
function formatMissionReviewBlockedAction(action: StartMissionReviewPolicy['blockedActions'][number]): string {
  const labels: Record<StartMissionReviewPolicy['blockedActions'][number], string> = {
    next_slice: 'Start another implementation slice',
    release: 'Release',
    publish: 'Publish',
    deploy: 'Deploy',
    push: 'Push',
    merge: 'Merge',
    version_bump: 'Version bump',
  };
  return `- ${labels[action]} (\`${action}\`)`;
}
```

- [ ] **Step 4: Run focused green tests**

Run:

```bash
npm run build
npx vitest run tests/core/start.test.ts tests/mcp/start.test.ts tests/cli/start.test.ts --testNamePattern "task card|fuzzy impact|Mission Control bundle|review-gate shortcut" --test-timeout 60000 --hook-timeout 60000
```

Expected: build and focused tests pass.

## Task 4: Docs And Screenshots

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update README**

In the Mission Control overview paragraph, mention that `missionControl.reviewGate.policy` carries the machine-readable approval boundary and blocked actions.

- [ ] **Step 2: Update GUIDE**

In the typical agent flow paragraph, mention `missionControl.reviewGate.policy` near the review-gate explanation.

- [ ] **Step 3: Update CHANGELOG**

Under `Unreleased > Added`, add:

```md
- Added `missionControl.reviewGate.policy`, a machine-readable approval boundary listing actions blocked until review: another slice, release, publish, deploy, push, merge, and version bump.
```

- [ ] **Step 4: Run docs screenshot capture**

Run:

```bash
npm run docs:screenshots
```

If PNGs change, inspect the changed image before committing.

## Task 5: Verification And Commit

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
git diff -- src/types.ts src/core/start.ts tests/core/start.test.ts tests/mcp/start.test.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md
```

- [ ] **Step 3: Commit the slice**

Commit with:

```bash
git add src/types.ts src/core/start.ts tests/core/start.test.ts tests/mcp/start.test.ts tests/cli/start.test.ts README.md docs/GUIDE.md CHANGELOG.md docs/superpowers/specs/2026-06-09-structured-review-policy-design.md docs/superpowers/plans/2026-06-09-structured-review-policy.md
git commit -m "feat: add structured review policy"
```

Do not release, publish, deploy, push, merge, or bump versions.

## Stop Condition

After the implementation commit is created and verification output is recorded, stop and report for human review.
