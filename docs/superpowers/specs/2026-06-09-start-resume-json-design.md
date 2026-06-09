# Start Resume JSON Design

## Context

Mission Control now builds a complete `missionControl.resume` object with the current cursor, MCP tool call, unlocked inputs, follow-up templates, checklist rows, and remaining proof. Agents can already read it in the full JSON report, but that report includes setup, workflow, risks, adoption, and evidence sections that are unrelated to resuming the current task.

## Goal

Add `projscan start --resume-json` so a developer or agent can retrieve only the compact resume object for the current intent.

## Recommended Approach

Implement a CLI-only shortcut that prints:

```ts
report.missionControl.resume
```

as compact JSON. This keeps the output stable because it reuses an existing object. It also keeps the full `projscan start --format json` report unchanged.

## Alternatives Considered

Add a new top-level `resumeOnly` report mode. That would require a second report contract and would make consumers choose between report shapes.

Print the resume checklist as JSON. That would be smaller, but it would omit the current prompt, current tool call, input bindings, follow-up templates, and proof queues that make the resume object valuable.

Add a new MCP tool. MCP clients already receive `missionControl.resume` through `projscan_start`; the gap is CLI copy/paste and shell automation.

## Behavior

`--resume-json` applies only in console mode. With `--format json`, projscan keeps returning the full start report.

Shortcut precedence should stay narrow-to-broad:

1. `--next-command`
2. `--next-tool-call`
3. `--ready-tool-calls`
4. `--proof-commands`
5. `--checklist`
6. `--resume-json`
7. `--runbook`
8. `--shortcuts`
9. `--handoff-prompt`

The output should be one compact JSON object followed by a newline.

## Testing

- CLI shortcut test: fuzzy impact intent prints a parseable resume JSON object with `currentStep.stepId`, `toolCall`, `inputBindings`, `checklist`, and `remainingProofToolCalls`, and omits full report headings.
- CLI JSON test: `--resume-json --format json` still emits the full report with `missionControl.resume`.
- Shortcut index test: `--shortcuts` lists `projscan start --resume-json --intent '<goal>'`.

## Docs And Screenshots

Update README, guide, changelog, and the Playwright demo HTML. Regenerate and inspect the README screenshots if the demo terminal block changes.

## Self-Review

- No placeholders remain.
- The design does not add a new report field or MCP tool.
- The shortcut exposes an existing object, so compatibility risk is low.
- The output shape is parseable by shell automation and agent tooling.
