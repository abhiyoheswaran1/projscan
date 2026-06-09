# Review Gate Decision Menu Design

## Context

Mission Control now gives reviewers the stop rule, checklist, done criteria, proof queue, and worktree evidence. That gets an autonomous agent to the review point, but the reviewer still has to infer which actions are allowed next.

The missing product detail is a decision menu. After a long agent run, the human should see the next choices in the artifact itself: approve another bounded slice, request changes, or review a version candidate. The gate must keep release and publish actions behind explicit approval.

## Goal

Add a structured reviewer decision menu to `missionControl.reviewGate` so review-only artifacts show the allowed next decisions without changing Mission Control routing, command execution, or release behavior.

## Approaches

### Recommended: add `reviewGate.decisions`

Add `decisions: StartMissionReviewDecision[]` to `StartMissionReviewGate`. Each decision has an id, label, description, and consequence. Render the same list in `reviewGate.markdown` under `## Reviewer Decision`.

This gives MCP/JSON clients a typed menu and gives humans a copyable checklist in `--review-gate` and saved `review-gate.md`.

### Alternative: put the choices in `reviewPrompt`

The prompt could mention the options, but clients would need string parsing. A prompt also tends to grow into prose instead of a stable product surface.

### Alternative: add a new CLI flag

A new `--review-decisions` shortcut would help terminal users, but it would fragment the review flow. The decision menu belongs in the gate that already tells the agent to stop.

## Design

Add a new interface:

```ts
export interface StartMissionReviewDecision {
  id: 'approve_next_slice' | 'request_changes' | 'review_version_candidate';
  label: string;
  description: string;
  consequence: string;
}
```

Add to `StartMissionReviewGate`:

```ts
decisions: StartMissionReviewDecision[];
```

`buildMissionReviewGate` creates the same additive decision list for every mission:

```ts
const decisions: StartMissionReviewDecision[] = [
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
```

Keep this deterministic. Do not inspect package versions, tags, registry state, or release metadata in this slice.

## Markdown

`missionControl.reviewGate.markdown` gains:

```md
## Reviewer Decision
- [ ] Approve next slice: The agent may start another bounded implementation slice. Consequence: No release, publish, deploy, or version bump is allowed unless the reviewer asks for it.
- [ ] Request changes: The agent must address review feedback before starting more scope. Consequence: The current mission stays open until feedback and proof are updated.
- [ ] Review version candidate: The agent may prepare release notes, version rationale, and remaining gates for review. Consequence: Publishing still requires a separate explicit approval.
```

Place it after `## Done When` and before `## Proof Queue`. The reviewer sees the mission target, chooses what may happen next, then checks proof.

## Docs

Update README, GUIDE, and CHANGELOG to mention `missionControl.reviewGate.decisions`. Use direct wording: this is a decision menu for stop-and-review handoffs, not automation that releases or publishes.

Run the existing screenshot capture command. Include image diffs only if the demo source or rendered assets change.

## Tests

- Core: `missionControl.reviewGate.decisions` contains the three ids in order, Markdown contains `## Reviewer Decision`, and the handoff review gate carries the same decisions.
- CLI bundle: saved `review-gate.md` contains the decision section and saved `handoff.json.reviewGate.decisions` matches the review gate.
- CLI shortcut: `--review-gate` prints the decision section and still omits the full start report.
- MCP: `projscan_start` exposes the decisions in `missionControl.reviewGate` and `missionControl.handoff.reviewGate`.

## Out of Scope

- New commands or flags.
- Release, publish, deploy, registry, or version-bump behavior.
- Dynamic release readiness checks.
- Changing success criteria, proof queue, worktree evidence, or routing.

## Auto-Mode Note

The user asked for auto-mode product iteration but also asked to stop after planned work for review. This slice makes that stop point easier to honor. After implementation, verification, and commit, stop for review.
