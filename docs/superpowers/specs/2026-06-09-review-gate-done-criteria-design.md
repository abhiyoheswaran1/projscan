# Review Gate Done Criteria Design

## Context

Mission Control now makes the review gate much more useful: it carries the stop rule, review checklist, current worktree evidence, and remaining proof queue. One critical question still lives outside the gate: what counts as done for this mission.

`missionControl.successCriteria` already answers that question, and task cards, runbooks, resume checklists, handoff prompts, and console output already use it. A developer or MCP agent reading only `missionControl.reviewGate`, `--review-gate`, `review-gate.md`, or `handoff.reviewGate` still has to cross-reference another object before approving more work.

## Goal

Add the mission done criteria to `missionControl.reviewGate` so the review-only artifact tells a reviewer what was supposed to be completed, which proof remains, and what worktree evidence to inspect.

## Approaches

### Recommended: copy success criteria into `reviewGate.doneWhen`

Add `doneWhen: string[]` to `StartMissionReviewGate`, derived from the existing `successCriteria` list in `buildMissionControl`. Render a `## Done When` section in `reviewGate.markdown`.

This keeps the review gate additive and gives JSON/MCP consumers the same criteria humans see in Markdown.

### Alternative: rely on `reviewPrompt`

The prompt could mention the first success criterion, but a prompt is hard to parse and loses the full list. That keeps the structured-review gap.

### Alternative: add done criteria only to Markdown

Markdown-only output helps humans but leaves MCP and JSON consumers without a structured field.

## Design

Add to `StartMissionReviewGate`:

```ts
doneWhen: string[];
```

Pass `successCriteria` into `buildMissionReviewGate`:

```ts
const reviewGate = buildMissionReviewGate({
  status,
  doneWhen: successCriteria,
  proof: reviewProof,
  currentWorktree: input.riskSources.currentWorktree,
});
```

The review gate stores a shallow copy:

```ts
const doneWhen = input.doneWhen.slice();
```

If the list is empty, `doneWhen` remains an empty array. The Markdown renderer falls back to:

```md
- The current mission is complete and verified.
```

Do not alter `missionControl.successCriteria`, execution-plan `done_when` rows, resume checklist rows, handoff prompt text, or task-card content.

## Markdown

`missionControl.reviewGate.markdown` gains:

```md
## Done When
- [ ] An exact symbol or file path is selected from search results before impact analysis continues.
- [ ] The impact report is reviewed for direct and transitive dependents before editing starts.
```

Place the section after `## Checklist` and before `## Proof Queue`. Reviewers see the approval checklist first, then the mission-specific done criteria, then proof and worktree evidence.

## Docs

Update README, GUIDE, and CHANGELOG to mention `missionControl.reviewGate.doneWhen`. The screenshot demo source does not need a copy change for this slice; run the existing screenshot capture to verify assets still render.

## Tests

- Core: `missionControl.reviewGate.doneWhen` equals `missionControl.successCriteria`; Markdown contains `## Done When` and a mission-specific criterion.
- CLI bundle: `review-gate.md` contains `## Done When`; saved `handoff.json.reviewGate.doneWhen` equals `handoff.doneWhen`.
- CLI shortcut: `--review-gate` prints `## Done When` and still omits full-report sections.
- MCP: `projscan_start` exposes `missionControl.reviewGate.doneWhen` and the same value through `handoff.reviewGate`.

## Out of Scope

- Changing done criteria generation.
- Adding new review commands.
- Changing `missionControl.successCriteria`.
- Release, publish, deploy, or version behavior.

## Auto-Mode Note

The user asked for auto-mode product iteration and later asked to stop after planned tasks. This design covers one bounded slice; after implementation, verification, and commit, stop for review.
