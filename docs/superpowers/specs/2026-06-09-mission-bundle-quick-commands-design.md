# Mission Bundle Quick Commands Design

## Context

Saved Mission Control bundles now include `mission.sh`, `status.sh`, and `review.sh`. The bundle README still opens with the current low-level command and a long file list. A developer who opens the bundle after a handoff has to infer the safer flow: run the mission script, check status, then review the evidence packet.

## Goal

Add a short `## Quick Commands` section near the top of saved mission bundle README files so a developer can run the bundle without reading the full manifest.

## Options Considered

1. **Keep only the file list.** This keeps the README compact but hides the intended workflow.
2. **Add another generated script.** This would duplicate `review.sh` and make the bundle noisier.
3. **Recommended: add README quick commands.** This uses the existing scripts, gives the right command order, and keeps the bundle easy to scan.

## Design

`missionBundleReadme()` will add this section immediately after the mission metadata and before `## Run Next`:

````md
## Quick Commands

```sh
./mission.sh
./status.sh
./review.sh
```

- `./mission.sh` runs the current command and remaining proof.
- `./status.sh` prints the latest mission state.
- `./review.sh` prints the review packet for approval.
````

The section does not replace the current `## Run Next` command. `## Run Next` remains useful when a developer wants to inspect or run only the cursor command.

## Files

- `src/cli/commands/start.ts`: update `missionBundleReadme()` to render quick commands.
- `tests/cli/start.test.ts`: assert the section contents and ordering.
- `README.md`: mention that saved bundle README files now include quick commands.
- `CHANGELOG.md`: add the unreleased entry.

## Tests

Focused CLI tests will prove that generated bundle README files contain `## Quick Commands`, include the three script commands in order, describe each script, place the section before `## Run Next`, and keep reviewer replies before the file list.

## Spec Review

- No placeholder requirements remain.
- The scope stays inside saved mission bundle onboarding.
- The design does not add new flags, release actions, publish actions, deploy actions, pushes, merges, or version bumps.
- The prose follows the existing README style and keeps the first-open workflow terse.
