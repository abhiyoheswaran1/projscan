# Start Save Mission Bundle Design

Mission Control now gives developers clean stdout shortcuts: current command, MCP call, proof queue, checklist, resume JSON, handoff JSON, runbook, and prompt. That helps when someone is sitting at a terminal. It still leaves a common handoff job to shell redirection: save the runbook, JSON state, proof commands, and MCP calls as files another process can attach, inspect, or pass to a teammate.

Add `projscan start --save-mission <dir>` so a developer can persist the current Mission Control state as a directory of handoff artifacts.

## Scope

- Add a write option to `projscan start`.
- Resolve the target directory relative to the repo root, matching `projscan handoff --write`.
- Create the directory recursively and overwrite the known bundle files.
- Write a concise bundle:
  - `runbook.md`
  - `handoff.json`
  - `resume.json`
  - `ready-tool-calls.json`
  - `proof-commands.txt`
  - `manifest.json`
- Add the command to `--shortcuts`, README, guide, changelog, and the demo HTML used for screenshots.
- Regenerate README screenshots with `npm run docs:screenshots`.

## Behavior

`projscan start --save-mission .projscan/mission --intent "<goal>"` writes files under `.projscan/mission` and prints a short confirmation:

```text
Wrote Mission Control bundle to /abs/repo/.projscan/mission
- runbook.md
- handoff.json
- resume.json
- ready-tool-calls.json
- proof-commands.txt
- manifest.json
```

`--format json` writes the same files and prints:

```json
{
  "missionBundle": {
    "schemaVersion": 1,
    "kind": "projscan.mission-bundle",
    "directory": "/abs/repo/.projscan/mission",
    "mode": "before_edit",
    "status": "needs_attention",
    "files": []
  }
}
```

The write option wins over console shortcuts when combined with them. This follows the `handoff --write` pattern: the user's explicit filesystem action receives a write result instead of a normal report.

## Manifest Shape

`manifest.json` includes:

- `schemaVersion: 1`
- `kind: "projscan.mission-bundle"`
- `directory`: absolute bundle directory
- `intent`: present when the start report has an intent
- `mode`: resolved start mode
- `status`: Mission Control status
- `currentStep`: the current cursor step id, phase id, command, and optional MCP tool call
- `files`: ordered file entries with `name`, absolute `path`, and `description`

The manifest does not duplicate the full handoff object. Consumers can read `handoff.json` or `resume.json` for that data.

## Alternatives

### Recommended: directory bundle

This gives a human-readable runbook and machine-readable JSON files in one command. It works for local agents, editor extensions, and CI attachments without requiring them to parse stdout.

### Single archive file

A tar or zip file would be easy to attach, but it adds compression logic and makes local inspection slower. A directory is enough for the current workflow.

### One `--write-runbook` file

Writing only Markdown would help humans but leave agents to reconstruct the JSON handoff and proof queues. The product already has those structured objects, so the bundle should preserve them.

## Tests

- CLI write test: `projscan start --save-mission artifacts/mission --intent "<fuzzy impact>" --quiet` writes all bundle files relative to the fixture repo root, exits 0, and prints the write confirmation.
- JSON write test: the same option with `--format json` writes the files and prints a `missionBundle` object.
- Shortcut discovery test: `--shortcuts` includes `projscan start --save-mission .projscan/mission --intent "<goal>"`.

## Docs And Screenshots

Use direct docs copy: "write the Mission Control bundle." Avoid vague claims about complete automation. Update README, guide, changelog, and `docs/demos/projscan-4-1-demo.html`. Regenerate screenshots and inspect the changed PNGs.

## Self-Review

- No placeholders remain.
- The feature is one CLI write option with docs and screenshots.
- The write behavior follows the existing root-relative artifact pattern.
- The design does not change core or MCP report schemas.
