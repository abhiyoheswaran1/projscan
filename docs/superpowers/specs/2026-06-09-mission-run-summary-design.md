# Mission Run Summary Design

## Context

Saved mission bundles now write command logs, `status.jsonl`, and a readable `run-report.md`. Humans can scan the Markdown report, but automation still has to infer mission state from JSONL rows. A wrapper should be able to open one file and answer: has the mission run, is it still running, did it pass, or which step failed?

## Product Goal

Add `proof-logs/summary.json` to saved Mission Control bundles. The file should start as `not_run`, switch to `running` when `mission.sh` starts, and end as `passed` or `failed`.

## Options

### Option A: Add `summary.json` Beside the Report

Create `proof-logs/summary.json` with a compact schema:

```json
{
  "schemaVersion": 1,
  "status": "not_run",
  "report": "proof-logs/run-report.md",
  "statusRows": "proof-logs/status.jsonl"
}
```

Saved `mission.sh` rewrites it to `running`, then `passed` or `failed`. Failure rows include `failedStep`, `exitCode`, and `log`.

Trade-off: this adds one file to the bundle, but it gives agents a stable status checkpoint without parsing Markdown or JSONL.

### Option B: Add a Final Summary Row to `status.jsonl`

Append a final row with result details.

Trade-off: this preserves file count, but callers still have to parse a stream and decide which row is authoritative.

### Option C: Put Result Text Only in `run-report.md`

Add a human result section to the report and stop there.

Trade-off: humans benefit, but automation remains brittle.

## Decision

Use Option A and also add a short `## Result` section to `run-report.md`. The JSON file is the automation contract; the Markdown result helps reviewers who open the report first.

## Behavior

- `projscan start --save-mission <dir>` creates `proof-logs/summary.json`.
- The top-level bundle README, manifest, JSON save output, and `proof-logs/README.md` list the file.
- Initial `summary.json` contains:
  - `schemaVersion: 1`
  - `status: "not_run"`
  - `report: "proof-logs/run-report.md"`
  - `statusRows: "proof-logs/status.jsonl"`
- Saved `mission.sh` writes `status: "running"` when it starts.
- If a command fails, saved `mission.sh` writes `status: "failed"` with `failedStep`, `exitCode`, `log`, `report`, and `statusRows`, then exits with that command status.
- If all commands pass, saved `mission.sh` writes `status: "passed"` with `totalCommands`, `report`, and `statusRows`.
- `run-report.md` gets a final result section:
  - passed: `All current and proof commands exited 0.`
  - failed: `Mission stopped before completion.`
- Console-only `projscan start --mission-script` does not mention `summary.json` or summary file variables.

## Testing

- Extend the saved bundle CLI test for:
  - `proof-logs/summary.json` in stdout, README, manifest, and JSON save output
  - initial JSON contents
  - saved `mission.sh` writes running, passed, and failed summaries
  - `run-report.md` success and failure result text
  - console-only `--mission-script` excludes summary plumbing
- Run the focused start CLI test red, implement, then run it green.
- Run docs screenshots and full verification before committing implementation.

## Out Of Scope

- No new CLI flag.
- No release, publish, deploy, push, merge, or version bump.
- No timestamps or duration fields; portable shell support matters more than timing metadata.
