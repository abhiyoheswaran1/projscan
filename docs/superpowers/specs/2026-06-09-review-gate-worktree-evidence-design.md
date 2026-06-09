# Review Gate Worktree Evidence Design

## Context

The Mission Review Gate tells an agent to capture `git status --short` and `git diff --stat` before asking for approval. Projscan already computes current worktree evidence for `start.evidence.riskSources.currentWorktree`, but the review gate does not carry that evidence.

That creates an avoidable gap in handoffs. A human or agent reading `missionControl.reviewGate` sees the commands to run, but not the current state projscan already knows: whether Git evidence is available, how many files are changed, which base ref was used, and which files are visible in the capped list.

## Goal

Add a small `missionControl.reviewGate.worktree` object so every review gate can include current worktree evidence:

- whether worktree evidence is available
- whether the visible worktree is clean
- changed file count
- base ref, when available
- visible changed files
- unavailable reason, when Git evidence cannot be collected
- a one-line summary for humans

## Approach

Use the existing `riskSources.currentWorktree` object produced by `buildStartRiskSources`. Do not run new Git commands.

Add a type:

```ts
export interface StartMissionReviewWorktree {
  available: boolean;
  clean: boolean;
  changedFileCount: number;
  files: string[];
  baseRef: string | null;
  summary: string;
  reason?: string;
}
```

Add `worktree: StartMissionReviewWorktree` to `StartMissionReviewGate`.

The summary rules:

- available + 0 files: `Current worktree evidence sees no changed files.`
- available + files: `Current worktree evidence sees N changed file(s) against <baseRef>.`
- unavailable: `Current worktree evidence is unavailable: <reason>.`

## Surfaces

The structured gate, handoff object, MCP output, `--review-gate`, `review-gate.md`, task card, runbook, and default console output should all draw from the same `missionControl.reviewGate.worktree`.

The Markdown review gate should add:

```md
## Worktree Evidence
Current worktree evidence sees 3 changed file(s) against main.
- `src/a.ts`
- `tests/a.test.ts`
```

If unavailable:

```md
## Worktree Evidence
Current worktree evidence is unavailable: not a git repository.
```

## Tests

Core tests should assert:

- `reviewGate.worktree.available`
- `reviewGate.worktree.clean`
- `reviewGate.worktree.changedFileCount`
- `reviewGate.worktree.summary`
- Markdown includes `## Worktree Evidence`

CLI tests should assert:

- `--review-gate` prints the worktree evidence section
- default console `Review Gate` prints the summary
- saved `review-gate.md` includes the section

MCP tests should assert:

- `missionControl.reviewGate.worktree` is present
- `missionControl.handoff.reviewGate.worktree` equals it

## Non-Goals

- Do not add new Git commands.
- Do not expose full uncapped file lists beyond the existing risk-source cap.
- Do not release, publish, deploy, or change the package version.
