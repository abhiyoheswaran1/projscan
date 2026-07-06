# AgentLoopKit proof-phase upgrade train

- Created date: 2026-07-06
- Task type: dependency-upgrade
- Status: in-progress

## Problem Statement
projscan still runs on agentloopkit 0.33.0, so the repo-local task, verification, handoff, and review workflow is behind the current loop idioms.

## Desired Outcome
Upgrade agentloopkit to 0.47.1, refresh the repo-local harness and guidance, prove the upgraded loop works end to end, and create the first follow-up dogfood slice contract without cutting a release.

## Constraints
- Do not bump projscan version, tag, publish, deploy, or prepare release artifacts during this proof phase.
- Use npm exec agentloop -- upgrade-harness --details after the dependency upgrade and copy relevant guidance manually.
- Prefer repo-local guidance and task-flow updates before any projscan product behavior changes.
- Use task-only verification where focused task commands exist; reserve broad verification for shared workflow changes.

## Non-Goals
- No additive 4.x release work in this task.
- No broad projscan feature expansion unrelated to the workflow upgrade.

## Assumptions
- Baseline captured on 2026-07-06 before proof-phase edits:
- `npm exec agentloop -- review-context` reported this task active and `in-progress`, latest verification `missing`, gates `fail`, policy status `8 current / 0 modified / 0 missing / 0 extra`, working tree `dirty (2)`, and next action `Run agentloop verify`.
- `npm exec agentloop -- status` reported project `projscan`, git branch `main` at `68e165e`, this task active and `in-progress`, no latest verification report, no latest open task, and next action `Run agentloop verify`.
- `npm exec agentloop -- policy show dependency-change-policy` required intentional dependency changes, intentional lockfile updates, and post-change `tests`, `typecheck`, and `build`.
- `npm exec agentloop -- policy status` reported all eight local policies current with no modified, missing, or extra entries.

## Likely Files or Areas
- package.json
- package-lock.json
- AGENTS.md
- AGENTLOOP.md
- .agentloop/harness
- .agentloop/README.md
- .agentloop/tasks/README.md

## Files or Areas Not to Touch
- None recorded yet.

## Acceptance Criteria
- package.json and package-lock.json upgrade agentloopkit to 0.47.1.
- AGENTS.md, AGENTLOOP.md, and relevant .agentloop harness files describe the upgraded loop coherently.
- The upgraded workflow produces current `review-context`, `status`, and `verify` evidence in this repo from the active proof-phase task.
- After fresh verification, the upgraded workflow also produces current `check-gates`, `ship`, and `maintainer-check` evidence in this repo.
- A follow-up dogfood slice contract is created from proof-phase evidence.

## Verification Commands
- npm exec agentloop -- review-context
- npm exec agentloop -- status
- npm run typecheck
- npm run lint
- npm run build
- npm test -- tests/reporters/consoleReviewReporter.test.ts

## Post-Verification Gates
- npm exec agentloop -- check-gates
- npm exec agentloop -- ship
- npm exec agentloop -- maintainer-check

## Implementation Plan
- Inspect relevant files before editing.
- Keep changes focused on this contract.
- Preserve the 2026-07-06 baseline facts above as the pre-upgrade proof point for workflow state and policy expectations.
- Record only leaf verification commands in this contract; operators can use `npm exec agentloop -- verify --task .agentloop/tasks/2026-07-06-agentloopkit-proof-phase-upgrade-train.md --task-commands --only-task-commands --write-run` as the wrapper that executes them and writes fresh verification evidence.
- Run the post-verification gates only after fresh verification evidence exists.
- Record any architecture decision in DECISIONS.md.

## Risk Notes
- Dependency upgrade may change command expectations or generated harness wording.
- Guidance rewrites can drift from actual CLI behavior if not verified with real AgentLoop runs.

## Rollback Notes
Revert package.json, package-lock.json, harness docs, and proof-phase task files if the upgraded loop fails verification.

## Handoff Requirements
- Summarize files changed.
- Include verification commands and results.
- State unverified areas honestly.
- Include risks, rollback notes, and reviewer checklist.
