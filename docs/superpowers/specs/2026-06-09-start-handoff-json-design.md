# Start Handoff JSON Shortcut Design

`missionControl.handoff` already carries the compact task transfer object: current cursor, resume payload, ready proof queue, runbook-ready prompt, and remaining proof. Developers can fetch it today only by reading the full `projscan start --format json` report and selecting the nested object.

Add `projscan start --handoff-json` so scripts, IDE commands, and agents can copy the whole handoff object without parsing prose or traversing the full start report.

## Scope

- Add a console shortcut flag on `projscan start`.
- Print only `report.missionControl.handoff` as compact JSON.
- Keep `--format json` behavior unchanged: full start report wins, matching the other shortcut flags.
- Add the shortcut to `--shortcuts`, README, guide, changelog, and the demo HTML used for screenshots.
- Regenerate README screenshots with the existing Playwright-backed `npm run docs:screenshots` script.

## Behavior

`projscan start --handoff-json --intent "<goal>"` prints a single JSON object. It includes the same object that full JSON exposes at `missionControl.handoff`, including `currentStep`, `resume`, and `readyProof`.

The shortcut sits between `--resume-json` and `--runbook` in the printed menu. That order keeps the structured JSON options together before Markdown and prompt-only views.

Precedence stays narrow-to-broad:

1. `--next-command`
2. `--next-tool-call`
3. `--ready-tool-calls`
4. `--proof-commands`
5. `--checklist`
6. `--resume-json`
7. `--handoff-json`
8. `--runbook`
9. `--shortcuts`
10. `--handoff-prompt`

## Alternatives

### Recommended: handoff JSON shortcut

This gives developers the object they already need for transfer and automation. It changes only CLI rendering, so the stable core/MCP contract does not move.

### Add a persisted handoff bundle

Writing files such as `runbook.md` and `resume.json` would help agents that hand work between processes. It creates filesystem semantics, path handling, and overwrite expectations. That is a larger product slice.

### Add handoff metadata to `--shortcuts`

The menu could print a JSON preview inline. That helps discovery but does not give scripts a clean command they can call.

## Tests

- CLI shortcut test: `projscan start --handoff-json --intent "<fuzzy impact>" --quiet` exits 0 and prints compact JSON for `missionControl.handoff`.
- JSON compatibility test: adding `--format json` still returns the full start report.
- Shortcut menu test: `--shortcuts` includes the new command.

## Docs And Screenshots

Update README, guide, changelog, and `docs/demos/projscan-4-1-demo.html`. Use direct copy that names the object and avoids broad claims. Regenerate screenshots with `npm run docs:screenshots` and inspect the changed PNGs.

## Self-Review

- No placeholders or future-only requirements remain.
- The scope is one CLI shortcut plus documentation and screenshots.
- The design does not change the core Mission Control schema.
- Shortcut precedence matches existing console-only behavior.
