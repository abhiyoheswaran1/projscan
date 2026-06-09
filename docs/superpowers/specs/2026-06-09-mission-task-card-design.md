# Mission Task Card Design

## Context

`projscan start --intent "<goal>"` now gives developers a full Mission Control report, a runbook, compact prompts, and a saved mission bundle. The bundle works, but the full runbook is more detail than a developer usually wants to paste into a PR, issue, chat thread, or handoff note.

Developers need a shorter artifact that answers four questions:

- What should I do next?
- What input is missing?
- What proof should I run?
- How do I know I can stop?

## Decision

Add a compact Mission Task Card. It is a Markdown checklist derived from the existing `missionControl.resume`, proof queue, and success criteria.

Expose it in two places:

- `projscan start --task-card --intent "<goal>"` prints only the Markdown task card.
- `projscan start --save-mission <dir>` writes `task-card.md` beside the runbook, prompts, JSON files, and proof files.

This is additive. It does not change existing commands, existing JSON fields, or existing bundle files.

## Shape

The task card has a stable Markdown layout:

```md
# Mission Task Card

Intent: what breaks if I rename the auth token loader
Status: needs_attention
Current step: ready-1 in ready_now

## Do Next
- [ ] Run `projscan search "auth token loader" --format json`
- [ ] Resolve `input-1` (`symbol`): Replace <symbol-from-search> with an exported symbol returned by the search step.

## Proof
- [ ] `projscan preflight --mode before_edit --format json`
- [ ] `projscan understand --view verify --format json`

## Done When
- [ ] An exact symbol or file path is selected from search results before impact analysis continues.

## Handoff Prompt
Resume: ...
```

The card includes MCP call annotations on checklist rows when the row already has `tool` and `args`. CLI-only proof rows say `CLI only` so agents do not assume every row maps to MCP.

## Architecture

Build the task card from the already-computed `StartReport` inside the start CLI command module. This keeps the feature tied to CLI and bundle presentation instead of expanding the stable core JSON contract. The card renderer should be a pure helper that accepts `StartReport` and returns a string ending in one newline.

`writeMissionBundle` writes `task-card.md` and `missionBundleFiles` lists it after `resume-prompt.txt`, before `runbook.md`. The quickstart README describes it as the paste-ready Markdown task card.

`--task-card` runs after JSON handling and before the default console output, matching existing shortcut behavior.

## Error Handling

If the renderer produces an empty card, `--task-card` exits with code 1 and prints a clear error. Normal mission reports always have a cursor and at least one done criterion fallback, so this path should only guard future regressions.

## Testing

Use TDD against the CLI surface:

- Add a failing test for `projscan start --task-card --intent ...` that expects Markdown headings, checkboxes, current command, MCP annotation, proof commands, done criteria, and handoff prompt.
- Extend the saved bundle test to expect `task-card.md` in stdout, quickstart README, manifest order, and file content.
- Extend the JSON bundle test to include `task-card.md`.

Run the focused start tests, build, lint, diff check, full test suite, stability check, security release gate, graph corpus check, and packed install smoke.

## Documentation And Assets

Update README, GUIDE, and CHANGELOG with the new shortcut and bundle file. Regenerate the README screenshot with `npm run docs:screenshots` so the demo reflects the new task-card wording if the demo copy changes.

Use direct prose. Avoid hype; the benefit is concrete: a paste-ready task card for PRs, issues, and handoffs.

## Self-Review

- No placeholders remain.
- The scope is one CLI shortcut plus one bundle artifact.
- The design reuses existing Mission Control data and avoids adding another planning schema.
- The behavior is additive under the stable surface policy.
