# Mission Bundle Prompt Files Design

Saved Mission Control bundles now include a quickstart README, next command, and next MCP call. The copyable handoff prompt and the resume prompt still live inside JSON or the Markdown runbook. That is fine for agents that parse JSON, but it slows the common human handoff: open a folder, copy one prompt into the next chat, and continue.

Add two standalone prompt files to every saved mission bundle:

- `handoff-prompt.txt`: the full `missionControl.handoffPrompt`.
- `resume-prompt.txt`: the focused `missionControl.resume.prompt`.

## Scope

- Extend `projscan start --save-mission <dir>`.
- Add both files to the bundle manifest, console write summary, quickstart README file list, and JSON write report.
- Keep existing bundle files and core/MCP report schemas unchanged.
- Update README, guide, changelog, and demo screenshot source.
- Regenerate README screenshots.

## Behavior

For the fuzzy impact intent, the bundle order becomes:

```text
README.md
next-command.txt
next-tool-call.json
handoff-prompt.txt
resume-prompt.txt
runbook.md
handoff.json
resume.json
ready-tool-calls.json
proof-commands.txt
manifest.json
```

`handoff-prompt.txt` contains one newline-terminated copy of `missionControl.handoffPrompt`.

`resume-prompt.txt` contains one newline-terminated copy of `missionControl.resume.prompt`.

`README.md` lists both files under `## Files`, so a developer opening the folder can choose between the full handoff prompt and the narrower resume prompt.

## Alternatives

### Recommended: two prompt text files

This keeps the prompts copyable without JSON parsing. It also preserves the difference between a full next-agent handoff and a cursor-only resume prompt.

### One combined prompts file

A single `prompts.md` would reduce file count, but it would make automation parse headings. Separate files keep the bundle script-friendly.

### No new files

The prompts already exist inside JSON and runbook output. That does not help the "copy this prompt from a folder" workflow.

## Tests

- Extend the bundle write test to assert stdout, manifest order, and README file list include `handoff-prompt.txt` and `resume-prompt.txt`.
- Assert `handoff-prompt.txt` contains the resume-aware handoff prompt.
- Assert `resume-prompt.txt` contains the current cursor resume prompt.
- Extend the JSON write-report test to include both prompt files.

## Docs And Screenshots

Update docs copy so the saved bundle lists prompt files as part of the artifact set. Update the demo HTML short line from "README.md + next-step files" to mention prompts as well. Regenerate and inspect README screenshots.

## Self-Review

- No placeholders remain.
- The slice is additive and backward-compatible.
- The prompt files derive from existing Mission Control fields.
- The design does not alter core or MCP schemas.
