# Review Gate Decision Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured reviewer decision menu to `missionControl.reviewGate` so stop-and-review artifacts make the allowed next decisions explicit.

**Architecture:** Reuse the existing review-gate builder and Markdown renderer. Add a deterministic `decisions` array to the review gate, copy it through handoff objects by object identity, and render `## Reviewer Decision` in the same review-gate Markdown consumed by CLI bundles, shortcuts, JSON, and MCP.

**Tech Stack:** TypeScript, Vitest, Commander CLI, Markdown docs.

---

## File Structure

- Modify `src/types.ts`: add `StartMissionReviewDecision` and `decisions: StartMissionReviewDecision[]`.
- Modify `src/core/start.ts`: build deterministic decisions, return them in `StartMissionReviewGate`, and render them in Markdown.
- Modify `tests/core/start.test.ts`: assert structured decisions, Markdown section, and handoff parity.
- Modify `tests/cli/start.test.ts`: assert saved `review-gate.md`, saved `handoff.json`, and `--review-gate` output.
- Modify `tests/mcp/start.test.ts`: assert MCP output carries decisions through review gate and handoff review gate.
- Modify `README.md`, `docs/GUIDE.md`, and `CHANGELOG.md`: document `missionControl.reviewGate.decisions`.

## Task 1: Red Tests

**Files:**
- Modify: `tests/core/start.test.ts`
- Modify: `tests/cli/start.test.ts`
- Modify: `tests/mcp/start.test.ts`

- [ ] **Step 1: Add core failing assertions**

In `start exposes a Mission Control task card for MCP and JSON clients`, after the existing `reviewGate.doneWhen` assertions, add:

```ts
expect(report.missionControl.reviewGate.decisions.map((decision) => decision.id)).toEqual([
  'approve_next_slice',
  'request_changes',
  'review_version_candidate',
]);
expect(report.missionControl.reviewGate.markdown).toContain('## Reviewer Decision');
expect(report.missionControl.reviewGate.markdown).toContain(
  '- [ ] Approve next slice: The agent may start another bounded implementation slice.',
);
expect(report.missionControl.reviewGate.markdown).toContain(
  'Consequence: No release, publish, deploy, or version bump is allowed unless the reviewer asks for it.',
);
expect(report.missionControl.handoff.reviewGate.decisions).toEqual(report.missionControl.reviewGate.decisions);
```

- [ ] **Step 2: Add CLI failing assertions**

In `start writes a Mission Control bundle when requested`, after the existing `reviewGate` done-criteria assertions, add:

```ts
expect(reviewGate).toContain('## Reviewer Decision');
expect(reviewGate).toContain('- [ ] Approve next slice: The agent may start another bounded implementation slice.');
expect(reviewGate).toContain('Publishing still requires a separate explicit approval.');
```

After the existing `handoff.reviewGate.doneWhen` assertion, add:

```ts
expect(handoff.reviewGate.decisions.map((decision: { id: string }) => decision.id)).toEqual([
  'approve_next_slice',
  'request_changes',
  'review_version_candidate',
]);
```

In `start review-gate shortcut prints the structured review gate markdown`, add:

```ts
expect(shortcut.stdout).toContain('## Reviewer Decision');
expect(shortcut.stdout).toContain('- [ ] Request changes: The agent must address review feedback before starting more scope.');
expect(report.missionControl.reviewGate.decisions.map((decision: { id: string }) => decision.id)).toEqual([
  'approve_next_slice',
  'request_changes',
  'review_version_candidate',
]);
```

- [ ] **Step 3: Add MCP failing assertions**

In `projscan_start returns MCP-callable args for fuzzy impact intents`, after the existing review-gate done-criteria assertions, add:

```ts
expect(result.start.missionControl.reviewGate.decisions.map((decision) => decision.id)).toEqual([
  'approve_next_slice',
  'request_changes',
  'review_version_candidate',
]);
expect(result.start.missionControl.reviewGate.markdown).toContain('## Reviewer Decision');
expect(result.start.missionControl.handoff.reviewGate.decisions).toEqual(
  result.start.missionControl.reviewGate.decisions,
);
```

- [ ] **Step 4: Run red tests**

Run:

```bash
npx vitest run tests/core/start.test.ts tests/cli/start.test.ts tests/mcp/start.test.ts --testNamePattern "task card|Mission Control bundle|review-gate shortcut|fuzzy impact" --test-timeout 60000 --hook-timeout 60000
```

Expected: fail because `reviewGate.decisions` and `## Reviewer Decision` do not exist yet.

## Task 2: Core Implementation

**Files:**
- Modify: `src/types.ts`
- Modify: `src/core/start.ts`

- [ ] **Step 1: Add the public type**

In `src/types.ts`, add before `StartMissionReviewGate`:

```ts
export interface StartMissionReviewDecision {
  id: 'approve_next_slice' | 'request_changes' | 'review_version_candidate';
  label: string;
  description: string;
  consequence: string;
}
```

Add to `StartMissionReviewGate` after `doneWhen`:

```ts
decisions: StartMissionReviewDecision[];
```

- [ ] **Step 2: Build deterministic decisions**

In `src/core/start.ts`, add a helper near `buildMissionReviewGate`:

```ts
function buildMissionReviewDecisions(): StartMissionReviewDecision[] {
  return [
    {
      id: 'approve_next_slice',
      label: 'Approve next slice',
      description: 'The agent may start another bounded implementation slice.',
      consequence: 'No release, publish, deploy, or version bump is allowed unless the reviewer asks for it.',
    },
    {
      id: 'request_changes',
      label: 'Request changes',
      description: 'The agent must address review feedback before starting more scope.',
      consequence: 'The current mission stays open until feedback and proof are updated.',
    },
    {
      id: 'review_version_candidate',
      label: 'Review version candidate',
      description: 'The agent may prepare release notes, version rationale, and remaining gates for review.',
      consequence: 'Publishing still requires a separate explicit approval.',
    },
  ];
}
```

- [ ] **Step 3: Carry decisions through review gate**

Inside `buildMissionReviewGate`, after `doneWhen`, add:

```ts
const decisions = buildMissionReviewDecisions();
```

Return `decisions` and pass it to `renderMissionReviewGateMarkdown`:

```ts
decisions,
```

- [ ] **Step 4: Render reviewer decisions**

Add `decisions: StartMissionReviewDecision[]` to `renderMissionReviewGateMarkdown` input.

Insert after the `## Done When` section and before `renderMissionReviewProofLines`:

```ts
'## Reviewer Decision',
...input.decisions.map(formatMissionReviewDecision),
'',
```

Add the formatter near the review-gate Markdown helpers:

```ts
function formatMissionReviewDecision(decision: StartMissionReviewDecision): string {
  return `- [ ] ${decision.label}: ${decision.description} Consequence: ${decision.consequence}`;
}
```

- [ ] **Step 5: Run focused core test**

Run:

```bash
npm run build && npx vitest run tests/core/start.test.ts --testNamePattern "task card" --test-timeout 60000 --hook-timeout 60000
```

Expected: build passes and the focused core test passes.

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

In the Mission Control review-gate paragraph, add:

```md
`missionControl.reviewGate.decisions` gives the reviewer the allowed next choices: approve another slice, request changes, or review a version candidate without publishing.
```

- [ ] **Step 3: Update GUIDE**

In the typical agent flow paragraph near the other review-gate fields, add:

```md
Use `missionControl.reviewGate.decisions` as the approval menu so agents do not infer permission to continue, release, or publish.
```

- [ ] **Step 4: Update CHANGELOG**

Under Unreleased / Added, add:

```md
- Added `missionControl.reviewGate.decisions`, a structured reviewer decision menu for approving another slice, requesting changes, or reviewing a version candidate without publishing.
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
git commit -m "feat: add reviewer decisions to review gate"
```

Expected: one feature commit. Do not release, publish, push, deploy, or change `package.json` version.
