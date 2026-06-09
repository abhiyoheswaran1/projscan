# Review Decision Replies Design

## Context

Mission Control now carries a reviewer decision menu through the review gate, task card, runbook, CLI bundles, and MCP output. The menu tells the reviewer which decision to make, but it still leaves the exact approval text to the human.

That gap matters in auto-mode. A reviewer may approve another slice, request changes, or ask for version-candidate review, and each path has a different boundary. The artifact should give the reviewer exact reply text so the next agent sees clear permission without inferring release, publish, deploy, push, merge, or version-bump approval.

## Goal

Add copyable reviewer reply text to each `missionControl.reviewGate.decisions` entry and render that text anywhere the decision menu appears.

## Approaches

### Recommended: add `reply` to each decision

Extend `StartMissionReviewDecision` with a `reply` string. Keep the existing three deterministic decisions and append `Reply: "<reply>"` in the shared Markdown formatter.

This keeps one typed source for JSON, MCP, saved handoff bundles, task cards, runbooks, and `--review-gate`.

### Alternative: add a separate reply template list

A separate `reviewGate.replyTemplates` array could work, but it would duplicate ids and labels already present in `decisions`. Clients would need to join two arrays before showing the reviewer a usable menu.

### Alternative: docs-only wording

README guidance could tell humans what to write. That would not help MCP clients or saved handoff bundles, and it would still make the reviewer remember the exact stop boundaries.

## Design

Extend the public type:

```ts
export interface StartMissionReviewDecision {
  id: 'approve_next_slice' | 'request_changes' | 'review_version_candidate';
  label: string;
  description: string;
  consequence: string;
  reply: string;
}
```

Use deterministic reply text:

```ts
[
  {
    id: 'approve_next_slice',
    reply: 'Approved: start one more bounded implementation slice. Do not release, publish, deploy, push, merge, or bump the version.',
  },
  {
    id: 'request_changes',
    reply: 'Changes requested: address the review feedback first, update proof, then stop for another review.',
  },
  {
    id: 'review_version_candidate',
    reply: 'Prepare a version-candidate review only. Do not publish, deploy, push, merge, or bump the version.',
  },
]
```

The formatter becomes:

```ts
function formatMissionReviewDecision(decision: StartMissionReviewDecision): string {
  return `- [ ] ${decision.label}: ${decision.description} Consequence: ${decision.consequence} Reply: "${decision.reply}"`;
}
```

Do not add new commands, flags, release state, registry checks, or dynamic version logic in this slice.

## Tests

- Core: assert the three decision ids still appear in order, each decision carries the expected `reply`, and review gate, task card, and runbook Markdown include `Reply: "..."`.
- CLI: assert saved `review-gate.md`, `--task-card`, `--review-gate`, `--runbook`, and saved `handoff.json.reviewGate.decisions` expose the reply text.
- MCP: assert `projscan_start` returns `reviewGate.decisions[*].reply`, and runbook/review-gate Markdown include the same text.

## Docs And Screenshots

Update README, GUIDE, and CHANGELOG with direct wording: reviewer decisions now include copyable replies. Regenerate the existing Playwright-backed screenshot artifacts through the docs screenshot script. Keep image diffs only when the rendered docs assets actually change.

## Out Of Scope

- Publishing, deploying, pushing, merging, release approval, registry publication, or version bumps.
- New CLI flags.
- Dynamic release readiness detection.
- Changing proof queues, worktree evidence, done criteria, or intent routing.

## Auto-Mode Note

The user asked for product iteration, documentation updates, and screenshots, while also asking to stop after planned work for review. This slice improves that stop point and then stops after implementation, verification, and commit.
