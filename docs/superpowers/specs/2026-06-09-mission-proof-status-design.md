# Mission Proof Status Design

## Context

Saved Mission Control bundles now include `mission.sh`, `proof-logs/README.md`, and log redirection for the current cursor command plus remaining proof commands. Reviewers can inspect command output, but they still need to open each log to learn which command passed or failed.

## Goal

Add a durable status index for saved mission-script runs.

## Recommended Approach

Have saved `mission.sh` write `proof-logs/status.jsonl` while it runs. Each command writes one JSON line with:

- `id`: stable row id such as `current-ready-1` or `proof-1`.
- `label`: human label printed by the script.
- `log`: relative log file name.
- `command`: command string that ran.
- `exitCode`: shell exit code.

The script should truncate `status.jsonl` at startup, write a row after each command, stop on the first non-zero exit, and print the failed log path to stderr. This preserves fail-fast behavior while leaving reviewers a compact status file.

## Alternatives Considered

Write a human-only `status.txt`. That is easier to read, but agents and CI scripts would need to parse loose text.

Keep status only in `proof-logs/README.md`. That file is static bundle metadata and cannot reflect a real run.

## Behavior

Only saved mission bundles get status tracking. Console `projscan start --mission-script` remains plain and does not mention `status.jsonl`.

If the script blocks because a command contains shell expansion syntax, it should not include command lines or create misleading status rows. The existing blocked-script output remains enough for that path.

## Testing

- Saved bundle test: `manifest.json` and console bundle output list `proof-logs/status.jsonl`.
- Saved bundle test: `proof-logs/status.jsonl` exists as an empty file before the script runs.
- Saved bundle test: `proof-logs/README.md` mentions `status.jsonl`.
- Script test: saved `mission.sh` sets `PROOF_STATUS_FILE`, truncates it at startup, appends JSONL rows with `exitCode`, and exits on a non-zero command.
- Console shortcut test: `--mission-script` does not include `PROOF_STATUS_FILE`.

## Docs And Screenshots

Update README, GUIDE, and CHANGELOG. Run `npm run docs:screenshots`; no image change is expected because demo HTML stays unchanged.

## Self-Review

- Scope is limited to saved mission bundles.
- The design keeps console scripts simple.
- The status file is machine-readable and does not require parsing command logs.
