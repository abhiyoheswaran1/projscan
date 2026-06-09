# Mission Manifest Quick Commands Design

## Context

Saved mission bundle README files now show quick commands for `./mission.sh`, `./status.sh`, and `./review.sh`. Human reviewers can open the README and see the workflow immediately. JSON clients still have to infer that workflow from the file list or parse Markdown, which creates avoidable friction for agents that receive `--save-mission --format json` output.

## Goal

Add structured quick commands to the saved mission bundle manifest so agents can read the bundle workflow without parsing README text.

## Options Considered

1. **Leave quick commands only in README.** This helps humans but keeps machine clients guessing.
2. **Put quick commands only in `shortcuts.json`.** That file describes `projscan start` shortcuts, not the generated saved-bundle scripts.
3. **Recommended: add `quickCommands` to `manifest.json`.** The manifest is already the bundle index, so it is the right place for the runnable saved-bundle workflow.

## Design

`MissionBundleManifest` will gain:

```ts
quickCommands: Array<{
  id: 'run' | 'status' | 'review';
  command: './mission.sh' | './status.sh' | './review.sh';
  description: string;
}>;
```

The generated array will use the same workflow and wording as the bundle README:

- `run`: `./mission.sh`, runs the current command and remaining proof.
- `status`: `./status.sh`, prints the latest mission state and next action.
- `review`: `./review.sh`, prints the review packet for approval.

The JSON returned by `projscan start --save-mission <dir> --format json` already serializes the same manifest object, so this addition will appear in both saved `manifest.json` and JSON CLI output. The console bundle summary will stay unchanged because it lists files only.

## Files

- `src/cli/commands/start.ts`: add the manifest type field, helper, and manifest assignment.
- `tests/cli/start.test.ts`: assert saved `manifest.json` and JSON output expose the structured quick commands.
- `README.md`: mention that the manifest exposes quick commands for agents.
- `CHANGELOG.md`: add an unreleased entry.

## Tests

Focused CLI tests will prove that saved `manifest.json` includes the three quick commands in order with ids, commands, and descriptions, and that JSON save output returns the same array. Existing bundle README tests keep the human quick-command surface covered.

## Spec Review

- No placeholder requirements remain.
- The scope stays inside saved mission bundle metadata.
- The design keeps existing file output and console output stable.
- The change does not release, publish, deploy, push, merge, or bump the version.
