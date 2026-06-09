# Shortcuts JSON Export Design

## Context

`projscan start --shortcuts --intent "<goal>"` prints a human-readable command menu for the current Mission Control run. That menu is useful in a terminal, but agents and scripts still have to scrape text to discover the same commands.

Saved mission bundles also list individual files and next-step artifacts, but they do not include one machine-readable index of shortcut commands.

## Goal

Add a machine-readable shortcut index:

- `projscan start --shortcuts-json --intent "<goal>"` prints only a compact JSON shortcut index.
- Saved mission bundles include `shortcuts.json`.
- The text `--shortcuts` output, saved `shortcuts.json`, and bundle README use the same shortcut list.

## Approaches

### Recommended: shared shortcut index builder

Build one internal shortcut index object and render it two ways: console text for `--shortcuts`, JSON for `--shortcuts-json` and saved bundles.

This keeps command order, quoting, and new shortcut additions in one place.

### Alternative: save raw `--shortcuts` text

Saving text would match the terminal output, but it would keep machine clients scraping human formatting. The product already has enough structured handoff artifacts that JSON is the better fit.

### Alternative: add shortcuts to `manifest.json`

The manifest should stay a file index. Adding a full command menu there would mix file metadata with runnable-command data and make the manifest harder to scan.

## Design

Add a Commander option:

```ts
.option('--shortcuts-json', 'print the Mission Control shortcut command index as JSON')
```

Create a shared index object:

```ts
interface StartShortcutIndex {
  schemaVersion: 1;
  kind: 'projscan.start-shortcuts';
  currentCommand?: string;
  currentToolCall?: StartMissionToolCall;
  baseCommand: string;
  shortcuts: StartShortcutEntry[];
}

interface StartShortcutEntry {
  id: string;
  label: string;
  command: string;
  description: string;
}
```

The ordered shortcuts should match the current console menu:

1. `next-command`
2. `next-tool-call`
3. `ready-tool-calls`
4. `proof-commands`
5. `checklist`
6. `resume-json`
7. `handoff-json`
8. `save-mission`
9. `task-card`
10. `review-gate`
11. `review-gate-json`
12. `review-policy`
13. `review-replies`
14. `runbook`
15. `handoff-prompt`
16. `start`

Handle the new shortcut near `--shortcuts`:

```ts
if (cmdOpts.shortcutsJson === true) {
  printShortcutsJsonOnly(report, {
    intent: typeof cmdOpts.intent === 'string' ? cmdOpts.intent : undefined,
    mode,
  });
  return;
}
```

`--format json` keeps the existing `start` behavior and prints the full report before shortcut flags are handled. The new flag is for console-mode narrow output, matching the existing shortcut precedence.

Saved bundles should write:

```text
shortcuts.json
```

with pretty JSON and a trailing newline.

## Tests

- CLI shortcut: `projscan start --shortcuts-json --intent "<goal>" --quiet` prints the compact shortcut index JSON plus newline and no broader start-report output.
- Shared rendering: `--shortcuts` contains commands from the same shortcut index.
- Saved bundle: `shortcuts.json` exists, includes the same command list, and appears in stdout, README, and manifest.
- JSON bundle mode: the returned manifest file list includes `shortcuts.json`.

## Docs And Screenshots

Update README, GUIDE, and CHANGELOG for `--shortcuts-json` and `shortcuts.json`. Run `npm run docs:screenshots`; keep generated image changes only if the capture script changes assets.

## Out Of Scope

- New shortcut behavior beyond exposing the index as JSON.
- MCP schema changes.
- Release, publish, deploy, push, merge, or version bump.

## Stop Point

After tests, docs, screenshots, verification, and a local commit, stop for review.
