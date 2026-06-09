# Mission Script Export Design

## Context

Mission Control now exposes the current command, MCP calls, proof queue, review gate, task card, runbook, and shortcut index. A developer can copy each piece, but a saved mission bundle still makes them open several files before running the current cursor and proof queue.

## Goal

Add a shell-script export that gives humans and agents one visible, reviewable artifact for the current Mission Control cursor plus remaining proof commands.

## Recommended Approach

Add a CLI-only `projscan start --mission-script` shortcut and write the same script as `mission.sh` in saved mission bundles. The script should:

- Use `#!/usr/bin/env sh` and `set -eu`.
- Print the intent, mode, status, and current step.
- Run the current cursor command when one exists.
- Run only the remaining ready proof commands from `readyProofCommands(report)`.
- Print the review stop condition and worktree-evidence commands at the end.

This keeps the stable `StartReport` shape unchanged while giving developers a one-file artifact they can inspect, run, or attach to CI scratch logs. It also respects the existing read-only posture because it uses Mission Control's ready command and proof queue instead of inventing new commands.

## Alternatives Considered

Add a `missionControl.script` field to the JSON report. That would make MCP clients see the script without another CLI flag, but it would add shell text to a core contract before there is evidence that every client wants it.

Add separate `run-current.sh` and `proof.sh` files. That makes each file smaller, but it keeps the bundle split and does not solve the one-artifact handoff problem.

## Behavior

`--mission-script` applies to console output. With `--format json`, projscan should keep returning the full start report, matching the other focused shortcut flags.

The saved mission bundle should include `mission.sh`, list it in the manifest, and describe it in the bundle README. The script should preserve the mission's intent-inferred mode behavior. Saved bundles should use `missionShortcutOptions(report)` for any self-referential shortcut command that appears in the script comments or docs.

If the cursor has no runnable command, the script should print the current instruction to stderr and exit `2` before proof commands run. That avoids hiding blocked input behind successful proof.

## Output Shape

Example:

```sh
#!/usr/bin/env sh
set -eu

printf '%s\n' 'projscan Mission Control'
printf '%s\n' 'Intent: what breaks if I rename the auth token loader'
printf '%s\n' 'Mode: before_edit'
printf '%s\n' 'Status: needs_attention'
printf '%s\n' 'Current step: ready-1 in ready_now'
printf '%s\n' ''
printf '%s\n' 'Run current command'
projscan search "auth token loader" --format json
printf '%s\n' ''
printf '%s\n' 'Run remaining proof'
projscan preflight --mode before_edit --format json
printf '%s\n' ''
printf '%s\n' 'Review gate'
printf '%s\n' 'Stop after the current Mission Control checklist and proof are complete.'
printf '%s\n' 'Capture: git status --short'
printf '%s\n' 'Capture: git diff --stat'
```

## Testing

- CLI shortcut test: `projscan start --intent "<fuzzy impact>" --mission-script --quiet` exits 0, prints a POSIX shell script, includes the current command, includes remaining proof, and does not include full report headings.
- Bundle test: `projscan start --save-mission <dir> --intent "<goal>"` writes `mission.sh`, lists it in the manifest and README, and keeps `manifest.directory` real-path behavior unchanged.
- JSON behavior test: `--mission-script --format json` exits 0 and returns the full start report.
- Precedence test: a narrower shortcut such as `--proof-commands --mission-script` prints proof commands, not the script.

## Docs And Screenshots

Update README, GUIDE, and CHANGELOG with direct copy. Add the command to the existing demo HTML and regenerate README screenshots with `npm run docs:screenshots`.

## Self-Review

- No placeholders remain.
- The scope is one CLI shortcut plus one saved-bundle artifact.
- The script runs only current ready commands and remaining proof commands.
- JSON and MCP contracts stay unchanged.
