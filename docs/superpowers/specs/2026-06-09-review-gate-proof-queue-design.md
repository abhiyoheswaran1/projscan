# Review Gate Proof Queue Design

## Context

Mission Control now gives agents a task card, runbook, resume object, handoff object, and review gate. The review gate names the stop boundary and now carries current worktree evidence. It still asks agents to complete remaining proof without carrying the mission-specific proof queue in the review-gate object itself.

That creates extra lookup work at the moment a developer or reviewer needs the least ambiguity. The proof queue already exists on `missionControl.resume` and `missionControl.handoff.readyProof`; the review gate will reuse that data instead of forcing consumers to cross-reference another object.

## Goal

Make `missionControl.reviewGate` self-contained enough for stop-and-review handoffs by adding the remaining proof queue to the review gate JSON and Markdown.

## Approaches

### Recommended: copy the remaining proof queue into `reviewGate.proof`

Add `missionControl.reviewGate.proof` with the same summary, commands, optional MCP tool calls, and optional structured proof items already computed for resume/handoff. Render a `## Proof Queue` section in `reviewGate.markdown`.

This approach is additive, keeps `commands` reserved for review evidence commands such as `git status --short`, and avoids new proof generation logic.

### Alternative: render proof only in Markdown

The Markdown shortcut would become more useful, but MCP and JSON consumers would still need to read `resume` or `handoff.readyProof`. That solves the human case and leaves the agent case incomplete.

### Alternative: replace `reviewGate.commands`

Replacing `commands` with proof commands would make the existing evidence-command field ambiguous and likely break consumers that already expect `git status --short` and `git diff --stat`.

## Design

Add:

```ts
export interface StartMissionReviewProof {
  summary: string;
  commands: string[];
  toolCalls?: StartMissionProofToolCall[];
  items?: StartMissionProofItem[];
}
```

Then add `proof: StartMissionReviewProof` to `StartMissionReviewGate`.

`buildMissionControl` already computes:

- `proofCommands`
- `executionPlan`
- `resume`
- `resume.remainingProofCommands`
- `resume.remainingProofToolCalls`
- `resume.remainingProofItems`

Build review proof from those existing values:

- `commands`: `resume.remainingProofCommands ?? proofCommands`
- `toolCalls`: `resume.remainingProofToolCalls` when non-empty
- `items`: `resume.remainingProofItems` when non-empty
- `summary`: `READY_PROOF_SUMMARY`

Pass that object into `buildMissionReviewGate`. Do not run new commands, inspect Git again, or recompute proof steps.

## Markdown

`missionControl.reviewGate.markdown` gains a `## Proof Queue` section before `## Evidence Commands`.

When structured proof items exist, render each item with the command plus either its MCP call or `CLI only`:

```md
## Proof Queue
Ready-to-run proof commands; placeholder follow-ups are excluded until Needs Input is resolved.
- `projscan preflight --mode before_edit --format json` (MCP: projscan_preflight {"mode":"before_edit"})
- `projscan handoff` (CLI only)
```

When only commands exist, render each command without an MCP annotation. When no proof commands exist, render `No proof commands are ready yet.`

## CLI

`projscan start --review-gate` prints `reviewGate.markdown`, so the shortcut includes the proof queue. The normal console already has `Ready Proof` and `Proof Queue`; keep the default `Review Gate` section compact and do not print the queue there again.

## Docs

Update README, guide, and changelog to say the review gate carries the remaining proof queue. Use direct wording and avoid new screenshots unless demo HTML changes. The screenshot source does not need to change for this slice.

## Tests

- Core: `missionControl.reviewGate.proof` equals the remaining proof data from `missionControl.resume`, and Markdown contains `## Proof Queue`.
- CLI bundle: `review-gate.md` includes the proof queue and saved `handoff.json.reviewGate.proof` carries the same commands.
- CLI shortcut: `--review-gate` prints the proof queue and still omits full report sections.
- MCP: `projscan_start` exposes the same proof queue through `missionControl.reviewGate` and handoff review gate.

## Out of Scope

- New proof commands.
- A new CLI flag.
- Changing `missionControl.proofCommands`.
- Changing release, publish, deploy, or version behavior.

## Auto-Mode Note

The user asked for auto-mode product iteration and later asked to stop after planned tasks. This design records one bounded slice; after implementation, verification, and commit, stop for review.
