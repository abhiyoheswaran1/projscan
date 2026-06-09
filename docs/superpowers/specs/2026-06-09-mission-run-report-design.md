# Mission Run Report Design

## Context

Saved Mission Control bundles already give agents a runnable `mission.sh`, raw command logs, and `proof-logs/status.jsonl`. That works for automation, but a reviewer still has to open the JSONL file or each log to learn whether the mission run passed.

The bundle should leave one readable proof summary after `mission.sh` runs.

## Product Goal

When a developer runs a saved mission bundle, `proof-logs/run-report.md` should show the current command, proof commands, exit codes, log links, and review gate commands in one file.

## Options

### Option A: Markdown Run Report in `proof-logs/`

`mission.sh` writes `proof-logs/run-report.md` as it runs. The file starts with mission metadata and a table. Each command appends a row with step id, label, exit code, and log path. The script appends review gate commands at the end when all commands pass.

Trade-off: shell-generated Markdown needs small helper functions, but the artifact is easy to read in GitHub, editors, and terminals.

### Option B: JSON Summary Only

Extend `status.jsonl` with a final summary row. Reviewers or tools can parse it and build their own view.

Trade-off: this helps automation but leaves humans with raw JSON. It does not solve the review pain.

### Option C: Top-Level `mission-report.md`

Write the run report at the bundle root.

Trade-off: reviewers may find it faster, but runtime output would sit next to static planning artifacts. Keeping runtime artifacts under `proof-logs/` keeps the bundle easier to scan.

## Decision

Use Option A. Add `proof-logs/run-report.md` to saved mission bundles and let `mission.sh` refresh it each run. Keep console `--mission-script` unchanged, so copy/paste output stays compact.

## Behavior

- `projscan start --save-mission <dir>` creates `proof-logs/run-report.md`.
- The bundle README and manifest list the new file.
- `proof-logs/README.md` tells reviewers to read `run-report.md` first, then `status.jsonl`, then raw logs.
- Saved `mission.sh` truncates and rewrites `run-report.md` at the start of each run.
- Each logged command appends one Markdown table row with:
  - command id
  - label
  - exit code
  - log path
- On command failure, the script records the failed row, appends a short failure note, prints the log and report path, and exits with that command status.
- On success, the script appends the review gate stop condition and capture commands.
- `projscan start --mission-script` does not mention `PROOF_REPORT_FILE`, `run-report.md`, or proof log redirection.

## Testing

- Extend `tests/cli/start.test.ts` for saved mission bundles:
  - stdout, README, manifest, and JSON bundle output include `proof-logs/run-report.md`
  - initial file exists with reviewer guidance
  - saved `mission.sh` initializes `PROOF_REPORT_FILE`, writes the Markdown table header, appends command rows, appends failure notes, and appends review gate commands
  - console `--mission-script` does not include run-report plumbing
- Run the focused start CLI test after implementation.
- Run build, lint, full tests, stability, release security gate, graph corpus, docs screenshots, and packed install smoke before claiming completion.

## Out Of Scope

- No new CLI flag.
- No release, publish, deploy, push, merge, or version bump.
- No parsing of `run-report.md` in MCP tools yet.
