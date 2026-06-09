# Start Proof Commands Flag Design

## Problem

Mission Control now gives developers a direct next command and a concise handoff prompt, but proof still requires scanning the full `Ready Proof` / `Proof Queue` console output or parsing JSON.

The product should make verification as easy to copy as the next action. That matters because projscan's value depends on developers proving changes before handing off, committing, or asking for review.

## Goal

Add `projscan start --proof-commands`, a console shortcut that prints only the ready proof commands, one per line.

Example:

```bash
projscan start --intent "what breaks if I rename the auth token loader" --proof-commands --quiet
```

The output should use the same resume-aware remaining proof queue as the normal console `Ready Proof` section, so the current cursor command is not repeated as proof.

## Non-Goals

- Do not change `missionControl.proofCommands`.
- Do not change JSON output shape.
- Do not add a new `--format` value.
- Do not execute proof commands.
- Do not release, publish, deploy, push, or update registry metadata.

## Design

Add a boolean `--proof-commands` option to `src/cli/commands/start.ts`.

Behavior:

- Compute the normal start report.
- If `--format json` is requested, keep existing JSON behavior and ignore `--proof-commands`; JSON already includes `missionControl.handoff.readyProof.commands` and `missionControl.resume.remainingProofCommands`.
- In console mode with `--proof-commands`, print the ready proof command list, one command per line, and return before the full report.
- Use `missionControl.handoff.readyProof.commands` when available; fall back to `missionControl.proofCommands` for older or unusual report shapes.
- If no proof commands are available, print a concise error to stderr and exit 1.

Shortcut precedence in console mode:

1. `--next-command`
2. `--proof-commands`
3. `--handoff-prompt`

This keeps the most specific command-only output ahead of broader handoff output.

## Tests

- CLI: `projscan start --intent "<fuzzy impact>" --proof-commands --quiet` exits 0, prints only proof commands, omits headings, and does not repeat the current search cursor command.
- CLI: `--proof-commands --format json` still emits full JSON with the ready proof command queue.
- Existing start CLI tests continue to pass.

## Docs

Update README, guide, and changelog near the existing Mission Control shortcut docs.

## Self-Review

- No placeholders remain.
- Scope is limited to CLI presentation and docs.
- The implementation reuses the existing ready-proof queue and does not create parallel proof selection logic.
- The error behavior for missing proof commands is explicit.
