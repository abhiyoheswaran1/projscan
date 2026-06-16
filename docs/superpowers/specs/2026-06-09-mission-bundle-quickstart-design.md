# Mission Bundle Quickstart Design

`projscan start --save-mission <dir>` now writes the durable Mission Control state. A developer who opens that folder still has to know which file to read first. Agents can parse `manifest.json`, but humans and lightweight editor tasks need a smaller entrypoint.

Add quickstart files to every saved Mission Control bundle:

- `README.md`: the first file a human opens.
- `next-command.txt`: the current cursor shell command, or the resume instruction when no command exists.
- `next-tool-call.json`: the current cursor MCP call as compact JSON, or `null` when the cursor has no mapped MCP call.

## Scope

- Extend the existing `--save-mission` bundle.
- Add the three files to `manifest.json` and the console write summary.
- Keep existing files and JSON write reporting intact.
- Update README, guide, changelog, and screenshot source copy.
- Regenerate README screenshots with the existing Playwright script.

## Behavior

For an impact intent, the bundle starts with:

```text
README.md
next-command.txt
next-tool-call.json
runbook.md
handoff.json
resume.json
ready-tool-calls.json
proof-commands.txt
manifest.json
```

`README.md` contains:

- intent, mode, status, and current step;
- the next shell command when present;
- the current MCP call when present;
- links to the rest of the bundle files.

`next-command.txt` is line-oriented and shell-friendly. For the common ready-command cursor, it contains:

```text
projscan search "auth token loader" --format json
```

`next-tool-call.json` contains the same compact call as `projscan start --next-tool-call`:

```json
{ "tool": "projscan_search", "args": { "query": "auth token loader" } }
```

If Mission Control points to a blocked input or done criterion instead of a command, `next-command.txt` contains `missionControl.resume.instruction`, and `next-tool-call.json` contains `null`.

## Alternatives

### Recommended: add entrypoint files

This keeps the bundle directory inspectable. Humans open `README.md`; scripts read `next-command.txt` or `next-tool-call.json`.

### Add more CLI flags

More shortcuts could print each file to stdout, but the product already has enough stdout shortcuts. The saved bundle needs better ergonomics inside the folder.

### Rename the bundle files

Renaming existing files would break early adopters of the bundle contract. Adding entrypoints preserves compatibility.

## Tests

- Extend the existing bundle write test to assert `README.md`, `next-command.txt`, and `next-tool-call.json` are written and listed in `manifest.json`.
- Assert `README.md` contains the intent, current step, next command, and file list.
- Assert `next-command.txt` contains the current cursor command.
- Assert `next-tool-call.json` contains the compact current MCP call.
- Extend the JSON write-report test to see the new files in `missionBundle.files`.

## Docs And Screenshots

Update README and guide wording so `--save-mission` mentions the quickstart README and next-step files. Update the demo HTML text so the screenshot communicates that the saved bundle has a first file to open. Regenerate and inspect the screenshots.

## Self-Review

- No placeholders remain.
- The slice is an additive bundle enhancement.
- Existing bundle files stay in place.
- Core and MCP report schemas stay unchanged.
