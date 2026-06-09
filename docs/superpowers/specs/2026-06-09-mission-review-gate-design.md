# Mission Review Gate Design

## Context

Long-running agent sessions need a clear stopping rule. Mission Control already tells an agent what to run, what inputs block follow-ups, and what proof remains. It does not yet tell the agent when to stop and ask for human review before starting a new slice.

That gap matters for release work and autonomous development. A developer can ask an agent to keep improving a repo, then still expect it to pause after the current plan, show proof, and wait before a version cut. Projscan should make that boundary explicit instead of leaving it to prompt discipline.

## Goal

Add a Mission Control review gate that tells humans and MCP agents:

- stop after the current Mission Control checklist and proof are complete
- report the proof and current working-tree state
- wait for approval before starting another slice, releasing, publishing, or deploying

## Approaches

### Chosen: Structured Review Gate on Mission Control

Add `missionControl.reviewGate` with a small stable object:

- `required: true`
- `status`
- `stopCondition`
- `reviewPrompt`
- `checklist`
- `commands`

The task card, runbook, console shortcut, and mission bundle all use that object. JSON and MCP clients get the same source as the CLI.

This fits the current architecture because Mission Control already owns the execution plan, resume object, runbook, task card, and handoff prompt.

### Alternative: Only Add Text to Task Card

Adding a `Review Gate` section only to Markdown would help humans, but MCP agents would still need to parse text. It would also drift from JSON and saved bundle behavior.

### Alternative: New Top-Level Command

A separate `projscan review-gate` command would make the feature discoverable, but it would fragment the `start` workflow. The boundary belongs inside the active mission.

## Behavior

`projscan start` should include `missionControl.reviewGate` for every mission. The gate is always required because review before new work is safe by default.

The gate checklist should be concrete:

- complete the current Mission Control task card
- run remaining ready proof
- capture `git status --short`
- capture `git diff --stat`
- stop and ask for approval before starting another slice, release, publish, or deploy

The gate commands should include:

- `git status --short`
- `git diff --stat`

When proof commands exist, the gate can point to the already-present proof queue instead of duplicating every command.

## CLI Surface

Add `projscan start --review-gate --intent "<goal>"`.

It prints only Markdown for the review gate. This keeps copy/paste output short for agents, PR notes, issue comments, and release-review checkpoints.

`projscan start --shortcuts` should include the new shortcut.

## Mission Bundle

`projscan start --save-mission <dir>` should write `review-gate.md`. The manifest should list it.

The mission bundle README should mention that file so a human opening the bundle sees the stop boundary.

## Markdown Surfaces

The task card should include:

```md
## Review Gate
- [ ] Complete this task card and remaining proof.
- [ ] Capture `git status --short`.
- [ ] Capture `git diff --stat`.
- [ ] Stop and ask for approval before starting another slice, release, publish, or deploy.
```

The runbook should include the same gate with the review prompt.

## Tests

Core tests should assert:

- `missionControl.reviewGate.required` is `true`
- `reviewGate.commands` includes the two Git commands
- task card Markdown includes `## Review Gate`
- runbook Markdown includes `## Review Gate`

CLI tests should assert:

- `--review-gate` prints the same Markdown as `missionControl.reviewGate.markdown`
- `--shortcuts` includes `--review-gate`
- saved bundles include `review-gate.md` in the manifest and on disk

MCP tests should assert:

- `projscan_start` returns `missionControl.reviewGate`

## Documentation

Update:

- `README.md`
- `docs/GUIDE.md`
- `CHANGELOG.md`
- `docs/demos/projscan-4-1-demo.html`

Regenerate README screenshots with `npm run docs:screenshots`.

## Non-Goals

- Do not release, publish, deploy, or change package version.
- Do not add a policy engine.
- Do not infer whether the repo is currently clean. The gate tells the user what evidence to collect.
