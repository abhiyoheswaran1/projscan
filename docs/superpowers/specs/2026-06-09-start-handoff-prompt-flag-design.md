# Start Handoff Prompt Flag Design

## Problem

`projscan start --intent "<goal>"` now exposes a high-quality `missionControl.handoffPrompt`, and the normal console output prints it. The full start report is still long. A developer who wants to hand off work to another agent must visually find and copy the prompt, or switch to JSON and parse it manually.

The product should make the smallest useful handoff directly copyable and scriptable from the terminal.

## Goal

Add a `projscan start --handoff-prompt` console-mode shortcut that prints only `missionControl.handoffPrompt` plus a trailing newline. This gives developers a simple command for copy/paste, shell pipes, and editor integrations:

```bash
projscan start --intent "what breaks if I rename the auth token loader" --handoff-prompt --quiet
```

## Non-Goals

- Do not change the `missionControl.handoffPrompt` text.
- Do not change the JSON report shape.
- Do not add a new `--format` value.
- Do not release, publish, deploy, or update registry metadata.

## Design

Add a boolean `--handoff-prompt` option to `src/cli/commands/start.ts`.

Command behavior:

- With default console output and `--handoff-prompt`, compute the normal start report, print exactly `report.missionControl.handoffPrompt`, and return before the full console report.
- With `--format json`, keep existing JSON behavior and ignore `--handoff-prompt` as a console shortcut. The JSON payload already includes `missionControl.handoffPrompt`.
- Keep `--include-handoff` unchanged. It still prints the full Markdown runbook when the full console report is requested.

This keeps the core Mission Control model unchanged and adds only a CLI presentation shortcut.

## Tests

- CLI: `projscan start --intent "<fuzzy impact>" --handoff-prompt --quiet` exits 0, prints a single prompt line, and does not include report headings such as `Start:`, `Mission Control`, `Agent Runbook`, or `Ready Proof`.
- CLI: `--handoff-prompt --format json` still returns full JSON with `missionControl.handoffPrompt`.

## Docs

Update README, guide, and changelog to show the new copy/paste command and explain that it is a console shortcut.

## Self-Review

- No placeholders remain.
- Scope is limited to CLI presentation and documentation.
- The JSON contract remains unchanged.
- The option name is explicit and aligned with the existing `missionControl.handoffPrompt` field.
