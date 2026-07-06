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
- None recorded yet.

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
- The upgraded workflow produces current review-context, status, verify, check-gates, ship, and maintainer-check evidence in this repo.
- A follow-up dogfood slice contract is created from proof-phase evidence.

## Verification Commands
- npm run typecheck
- npm run lint
- npm run build
- npm test -- tests/reporters/consoleReviewReporter.test.ts

## Post-Verification Gates
- No post-verification gate recorded. Use this for commands that need a fresh AgentLoop verification report.

## Implementation Plan
- Inspect relevant files before editing.
- Keep changes focused on this contract.
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
