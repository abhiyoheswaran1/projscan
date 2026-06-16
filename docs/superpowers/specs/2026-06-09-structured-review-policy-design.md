# Structured Review Policy Design

## Context

Mission Control review gates now tell agents to stop after the current checklist and proof, then wait for reviewer approval. Human-facing surfaces also repeat the important boundary: do not release, publish, deploy, push, merge, or bump the version unless the reviewer asks for it.

That boundary is still mostly prose. JSON and MCP clients can read `missionControl.reviewGate.decisions`, but they must parse reply text or consequences to know which actions stay blocked. A safer agent product should make the stop policy explicit and machine-readable.

## Goal

Add a structured review policy to `missionControl.reviewGate` and `missionControl.handoff.reviewGate`:

- `approvalRequired: true`
- `blockedActions`: `next_slice`, `release`, `publish`, `deploy`, `push`, `merge`, `version_bump`
- `summary`: one human-readable sentence explaining that those actions require explicit reviewer approval

Render the same policy in review-gate Markdown so saved `review-gate.md`, `--review-gate`, task cards, and runbooks keep the policy visible.

## Approaches

### Recommended: typed `policy` object on the existing review gate

Add a `StartMissionReviewPolicy` type and a `policy` field to `StartMissionReviewGate`. Build it next to the existing checklist, decisions, proof, and worktree evidence. Render a `## Review Policy` section with friendly labels for the blocked actions.

This keeps one review-gate object as the source of truth for human and agent clients.

### Alternative: add only `blockedActions` to the review gate

A flat array is enough for enforcement, but it leaves clients guessing whether approval is always required and why the list exists.

### Alternative: keep blocked actions only in decision replies

The current replies are useful for humans, but string parsing is brittle for agents. It also hides the policy when a client wants to enforce the boundary before showing a reviewer menu.

## Design

Add types in `src/types.ts`:

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

Add `policy: StartMissionReviewPolicy` to `StartMissionReviewGate`.

In `src/core/start.ts`, build a policy with the fixed blocked-action list. Pass it to `renderMissionReviewGateMarkdown()`, include it in the returned review gate, and render:

```md
## Review Policy

Approval required: yes
Blocked until approval:

- Start another implementation slice (`next_slice`)
- Release (`release`)
- Publish (`publish`)
- Deploy (`deploy`)
- Push (`push`)
- Merge (`merge`)
- Version bump (`version_bump`)
```

Do not change decision ids or reply text.

## Tests

- Core: `missionControl.reviewGate.policy` equals the expected object, Markdown contains `## Review Policy`, and `missionControl.handoff.reviewGate.policy` matches the review gate.
- MCP: `projscan_start` returns the same policy in `missionControl.reviewGate` and `missionControl.handoff.reviewGate`.
- CLI: `--review-gate` output and saved `review-gate.md` contain the policy section and blocked-action labels.

## Docs And Screenshots

Update README, GUIDE, and CHANGELOG to mention the machine-readable review policy. Run `npm run docs:screenshots`; keep image changes only if the capture script changes assets.

## Out Of Scope

- New reviewer decisions.
- New release workflow behavior.
- Blocking commands at runtime.
- Release, publish, deploy, push, merge, or version bump.

## Stop Point

After tests, docs, screenshots, verification, and a local commit, stop for review.
