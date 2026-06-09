# Mission Status Script Design

## Context

Saved mission bundles now include `proof-logs/summary.json`, which records `not_run`, `running`, `passed`, or `failed` state. That helps agents, but a developer or CI wrapper still needs to remember how to parse the file. The bundle should expose a single executable status check.

## Product Goal

Add a saved bundle `status.sh` script that reads `proof-logs/summary.json`, prints the current mission state with report/log pointers, and exits with a useful status code.

## Options

### Option A: Add `status.sh` at the Bundle Root

Create an executable `status.sh` beside `mission.sh`. It uses Node to parse `proof-logs/summary.json`, prints:

- `Mission status: <state>`
- `Report: proof-logs/run-report.md`
- `Status rows: proof-logs/status.jsonl`
- failure details when present

Exit codes:

- `0` for `passed`
- `1` for `failed`
- `2` for `not_run`, `running`, missing summary, invalid JSON, or missing Node

Trade-off: this adds one file and depends on Node, but projscan already runs on Node and the script avoids fragile shell JSON parsing.

### Option B: Add Instructions Only

Document `node -e` commands in the bundle README.

Trade-off: no new file, but developers still have to copy commands and scripts have to duplicate parsing.

### Option C: Add a New Global CLI Command

Add `projscan mission-status <dir>`.

Trade-off: useful later, but larger than the current bundle-focused workflow. A saved script works even when a reviewer opens the artifact directory first.

## Decision

Use Option A. `status.sh` lives at the bundle root, reads the summary file relative to itself, and keeps the exit-code contract small.

## Behavior

- `projscan start --save-mission <dir>` creates executable `status.sh`.
- The bundle README, manifest, and JSON save output list `status.sh`.
- The script reads `${MISSION_DIR}/proof-logs/summary.json`.
- Missing `node` prints `Node.js is required to read proof-logs/summary.json.` and exits `2`.
- Missing or invalid summary prints a direct error and exits `2`.
- `status: "passed"` prints the report and status row paths, then exits `0`.
- `status: "failed"` prints failed step, exit code, log path, report path, and status row path, then exits `1`.
- `status: "not_run"` or `status: "running"` prints the state and exits `2`.
- The generated script passes `sh -n`.

## Testing

- Extend the saved bundle CLI test for:
  - `status.sh` in stdout, README, manifest, and JSON bundle output
  - executable script content
  - `node` parser use
  - state-specific exit code logic
- Add a focused script smoke in the test fixture:
  - initial `summary.json` returns exit code `2` and prints `Mission status: not_run`
  - `passed` summary returns exit code `0`
  - `failed` summary returns exit code `1` and prints failed step/log details
- Keep `projscan start --mission-script` unchanged.
- Run docs screenshots and full verification before committing implementation.

## Out Of Scope

- No global `projscan mission-status` command.
- No release, publish, deploy, push, merge, or version bump.
- No `jq` dependency.
