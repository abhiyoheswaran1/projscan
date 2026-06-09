# Mission Proof Logs Design

## Context

`projscan start --mission-script` gives a developer one script for the current Mission Control cursor and remaining proof queue. Saved mission bundles now include that script, but a reviewer still has to rely on terminal scrollback or manually redirect command output to keep proof.

## Goal

Make saved mission bundles preserve command output when `mission.sh` runs.

## Recommended Approach

Keep the console `--mission-script` output unchanged. For saved mission bundles only, generate `mission.sh` with a `proof-logs/` directory beside the bundle and redirect each runnable command into a named log file:

- `proof-logs/current-<step-id>.log` for the current cursor command.
- `proof-logs/proof-<n>.log` for each remaining proof command.
- `proof-logs/README.md` in the bundle, listing the expected log files and the commands that produce them.

The generated script should create `proof-logs/` at runtime, print each log path before running the command, and avoid `eval`. If a command contains shell expansion syntax, keep the existing blocked-script behavior and do not include command lines or logs.

## Alternatives Considered

Pipe commands through `tee` so users see output and logs at the same time. POSIX shell cannot preserve failing command exit status through a pipeline without non-portable `pipefail`, so this design redirects output instead.

Add a new `projscan mission run` command. That could manage logs and structured status better, but it adds a new command surface before the shell-script workflow has enough feedback.

## Behavior

`projscan start --mission-script` still prints the plain script. Saved bundles call the same renderer with proof-log mode enabled.

Saved bundles should include `proof-logs/README.md` in the manifest. Running `mission.sh` should write logs to `proof-logs/` relative to the script location, so it works even when launched from another directory.

## Testing

- Saved bundle test: `mission.sh` contains `MISSION_DIR`, `PROOF_LOG_DIR`, `mkdir -p "$PROOF_LOG_DIR"`, current/proof log file names, and redirections.
- Saved bundle test: `proof-logs/README.md` lists `current-ready-1.log`, `proof-1.log`, and the commands that create them.
- Console shortcut test: `--mission-script` does not include proof-log setup by default.
- Safety test: unsafe shell-expansion commands still produce the blocked script and omit command/log lines.

## Docs And Screenshots

Update README, GUIDE, and CHANGELOG. The existing Mission Control screenshot does not need a visual change unless the shortcut menu copy changes.

## Self-Review

- The scope stays within saved mission bundles.
- The design preserves the no-eval safety boundary.
- Console `--mission-script` remains easy to inspect and copy.
