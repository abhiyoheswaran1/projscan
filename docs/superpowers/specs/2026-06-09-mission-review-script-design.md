# Mission Review Script Design

## Context

Saved Mission Control bundles already give a developer the artifacts they need to resume, run proof, and stop for review: `mission.sh`, `status.sh`, `review-gate.md`, `review-replies.txt`, and `proof-logs/run-report.md`. The reviewer still has to know which files to open and which commands to run. That slows the review loop and makes it easier for an agent to keep working without a clean approval boundary.

## Goal

Add a saved bundle `review.sh` script that gives reviewers one command for checking mission state, reading the review gate, seeing proof output, and copying the allowed reviewer replies.

## Options Considered

1. **Print file paths only.** This is small but still forces reviewers to jump between files.
2. **Run git evidence commands from the bundle.** This is convenient but risky because saved bundles can live outside the repo root.
3. **Recommended: print a stitched review packet and command checklist.** This keeps the script portable, avoids guessing the repo root, and gives reviewers the right material in one terminal view.

## Design

`writeMissionBundle()` will generate an executable `review.sh` beside `mission.sh` and `status.sh`. The script will:

- Locate its own bundle directory with `MISSION_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)`.
- Run `status.sh` when present, capturing its exit code without aborting the script.
- Print the review gate from `review-gate.md` when present.
- Print the run report from `proof-logs/run-report.md` when present.
- Print the review evidence commands as copyable checklist lines.
- Print the contents of `review-replies.txt` when present.
- Exit with the same status code reported by `status.sh`: `0` for passed, `1` for failed, and `2` for not-run, running, missing, or unreadable status.

The script will not execute `git status --short` or `git diff --stat`. It will show those commands because projscan cannot assume the saved bundle path is the repository root.

## Files

- `src/cli/commands/start.ts`: add `review.sh` generation, manifest metadata, and a helper that builds the script.
- `tests/cli/start.test.ts`: add red-green coverage for script contents, manifest entries, quickstart text, executable bit, and runtime behavior before `mission.sh` has run.
- `README.md`: document `review.sh` in the saved bundle section.
- `CHANGELOG.md`: add the unreleased entry.

## Tests

Focused tests will prove that `projscan start --save-mission` writes `review.sh`, lists it in console output, README, JSON manifest, and JSON save output, marks it executable, and can run it against the initial `not_run` summary. The runtime test will assert the script prints `Mission Review`, calls through to `status.sh`, includes `review-gate.md`, includes `proof-logs/run-report.md`, shows `git status --short` and `git diff --stat`, prints reviewer replies, and exits `2` before proof has run.

## Spec Review

- No placeholders remain.
- Scope stays within saved mission bundle review ergonomics.
- The script preserves release and review boundaries by surfacing approval text instead of granting permission.
- The design avoids repo-root guessing and avoids executing unrelated git commands from an arbitrary bundle path.
