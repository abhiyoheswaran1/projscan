# Mission Summary Next Action Design

## Context

Saved mission bundles now give developers three clear shell entry points: `./mission.sh`, `./status.sh`, and `./review.sh`. `status.sh` prints a `Next action:` line, but the machine-readable summary still exposes only the mission state, report, and status row paths. Agents and wrappers that read `proof-logs/summary.json` must recreate the same state map or parse shell output.

## Goal

Add a stable `nextAction` string to `proof-logs/summary.json` so agents and JSON clients can decide what to do next without running or parsing `status.sh`.

## Options Considered

1. Keep next actions only in `status.sh`. This keeps JSON stable but leaves automation with weaker guidance.
2. Add a nested `guidance` object. This leaves room for future fields, but it adds structure before the bundle needs it.
3. Add a top-level `nextAction` string. This matches the existing flat summary shape and gives clients the useful field now.

Option 3 is the best fit for this slice.

## Design

`missionInitialRunSummary()` will include:

```json
{
  "schemaVersion": 1,
  "status": "not_run",
  "nextAction": "run ./mission.sh to generate proof.",
  "report": "proof-logs/run-report.md",
  "statusRows": "proof-logs/status.jsonl"
}
```

`scriptWriteSummaryJson()` will add `nextAction` for generated run states:

- `running`: `wait for ./mission.sh to finish, or inspect proof-logs/status.jsonl.`
- `passed`: `run ./review.sh and choose a reviewer reply.`
- `failed`: `inspect the failed log, fix the issue, then rerun ./mission.sh.`

Generated `status.sh` will prefer `summary.nextAction` when it is a string. If an older bundle lacks the field, `status.sh` will keep its current fallback map and exit-code behavior.

## Files

- `src/cli/commands/start.ts`: add shared next-action strings to summary JSON generation and status-script output.
- `tests/cli/start.test.ts`: assert the initial summary includes `nextAction`, generated `mission.sh` writes next actions for running, passed, and failed states, and `status.sh` prefers a custom `summary.nextAction`.
- `README.md`: mention that `summary.json` carries the same next action for agents.
- `CHANGELOG.md`: add an unreleased bullet.

## Tests

The focused CLI test will cover the generated saved bundle. A direct smoke command will create a bundle from `dist/cli/index.js`, read `proof-logs/summary.json`, and run `status.sh` to prove both JSON and shell surfaces agree.

## Spec Review

- No placeholders remain.
- The scope stays inside saved mission bundle summary guidance.
- The design keeps older bundle fallback behavior in `status.sh`.
- The change does not release, publish, deploy, push, merge, or bump the version.
