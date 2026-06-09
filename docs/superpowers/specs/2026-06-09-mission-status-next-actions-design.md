# Mission Status Next Actions Design

## Context

Saved mission bundles now include a clear run and review loop: `mission.sh`, `status.sh`, `review.sh`, proof logs, and quick commands in the bundle README. `status.sh` prints the machine state and exit code, but it leaves the developer to infer the next step. That gap matters during handoffs because a tired reviewer or resumed agent may see `not_run`, `running`, `failed`, or `passed` and still need to decide what command to run.

## Goal

Add a `Next action:` line to generated `status.sh` output so every mission state tells the developer what to do next.

## Options Considered

1. **Only document next actions in README.** This helps first-open use but does not help when agents call `status.sh` directly.
2. **Teach `review.sh` to parse summary JSON.** This would duplicate `status.sh` logic and split the source of truth.
3. **Recommended: add next actions to `status.sh`.** `review.sh` already invokes `status.sh`, so one change improves both direct status checks and review packets.

## Design

`buildMissionStatusScript()` will keep the existing state and exit-code behavior, then print one additional line:

- `not_run`: `Next action: run ./mission.sh to generate proof.`
- `running`: `Next action: wait for ./mission.sh to finish, or inspect proof-logs/status.jsonl.`
- `failed`: `Next action: inspect the failed log, fix the issue, then rerun ./mission.sh.`
- `passed`: `Next action: run ./review.sh and choose a reviewer reply.`
- Any other status: `Next action: inspect proof-logs/summary.json.`

The line belongs in the Node block after optional report/log details and before setting `process.exitCode`. It will not change exit codes or summary JSON shape.

## Files

- `src/cli/commands/start.ts`: update generated `status.sh`.
- `tests/cli/start.test.ts`: assert status-script contents and runtime next-action output for `not_run`, `passed`, and `failed`; assert `review.sh` includes the `not_run` next action through its `status.sh` call.
- `README.md`: say `status.sh` prints the next action.
- `CHANGELOG.md`: add an unreleased entry.

## Tests

Focused CLI tests will prove that saved bundles generate a `status.sh` containing the next-action map, that initial status output tells developers to run `./mission.sh`, that passed status points to `./review.sh`, that failed status points to the failed log and rerun command, and that `review.sh` inherits the not-run guidance.

## Spec Review

- No placeholder requirements remain.
- The scope stays inside generated status guidance.
- The design keeps existing exit codes stable.
- The change does not release, publish, deploy, push, merge, or bump the version.
