# Start Shortcuts Index Design

## Context

`projscan start --intent "<goal>"` now has focused console shortcuts for the current shell command, MCP tool call, proof commands, resume checklist, Markdown runbook, and handoff prompt. Each shortcut works well once a developer knows it exists. The product still makes the developer remember the menu.

## Goal

Add `projscan start --shortcuts` so a developer or agent can ask projscan for the copyable shortcut surface for the current mission.

## Recommended Approach

Implement a CLI-only shortcut index. It should compute the normal start report, then print a compact menu with:

- The current shell command when one exists.
- The current MCP tool call as compact JSON when one exists.
- The focused `projscan start` shortcut commands for next command, next tool call, proof commands, checklist, runbook, and handoff prompt.
- A full-report command for returning to the complete Mission Control view.

This approach keeps structured data unchanged and avoids expanding the MCP API before there is evidence that agents need a dedicated field.

## Alternatives Considered

Add shortcut metadata to `StartReport`. That would make shortcuts visible in JSON and MCP immediately, but it would add product-specific CLI command strings to the stable report contract before they are needed.

Add a separate command such as `projscan shortcuts start`. That keeps `start` smaller, but it hides the menu away from the workflow where developers need it.

## Behavior

`--shortcuts` applies only to console output. With `--format json`, projscan should keep returning the full start report, matching the behavior of the other console shortcut flags.

When the user provides `--intent`, the generated commands should preserve that intent using shell-safe quoting. When the user provides `--mode`, the generated commands should preserve the explicit mode. If neither is present, the commands should omit both flags.

Specific shortcuts keep precedence when multiple shortcut flags are passed. For example, `--proof-commands --shortcuts` should print proof commands because that is the narrower request.

## Output Shape

The console output should avoid the full report headings and use short sections:

```text
Mission Shortcuts
Current command:
projscan search "auth token loader" --format json

Current MCP tool call:
{"tool":"projscan_search","args":{"query":"auth token loader"}}

Copy from here:
projscan start --next-command --intent 'what breaks if I rename the auth token loader'
projscan start --next-tool-call --intent 'what breaks if I rename the auth token loader'
projscan start --proof-commands --intent 'what breaks if I rename the auth token loader'
projscan start --checklist --intent 'what breaks if I rename the auth token loader'
projscan start --runbook --intent 'what breaks if I rename the auth token loader'
projscan start --handoff-prompt --intent 'what breaks if I rename the auth token loader'
projscan start --intent 'what breaks if I rename the auth token loader'
```

## Testing

- CLI shortcut test: `projscan start --intent "<fuzzy impact>" --shortcuts --quiet` exits 0, prints `Mission Shortcuts`, includes the current command, the compact MCP JSON, all focused shortcut commands, and does not print full report sections.
- CLI JSON test: `--shortcuts --format json` exits 0 and returns the full report with `missionControl.executionPlan.cursor`.
- Precedence test: `--shortcuts --proof-commands` prints only proof commands.

## Docs And Screenshots

Update the README shortcut block and options table. Update the existing Playwright-generated demo HTML so the Mission Control screenshot shows the `--shortcuts` discovery command alongside the focused outputs. Regenerate the README screenshots with `npm run docs:screenshots` and visually inspect the changed images.

## Self-Review

- No placeholders remain.
- The scope is one CLI shortcut surface plus docs/screenshots.
- The design preserves the existing JSON and MCP contracts.
- The output avoids ambiguous labels and gives copyable commands.
