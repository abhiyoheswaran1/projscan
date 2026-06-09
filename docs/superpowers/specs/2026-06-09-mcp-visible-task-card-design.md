# MCP-Visible Task Card Design

## Context

`projscan start --task-card` and saved mission bundles now produce a paste-ready Markdown task card. That helps humans using the CLI, but MCP agents only receive the lower-level pieces: `missionControl.resume`, `missionControl.handoff`, proof queues, and the runbook.

An agent can rebuild the card, but that burns context and risks a different handoff shape in each client. The card should come from the same Mission Control payload that already drives MCP `projscan_start`.

## Decision

Add `missionControl.taskCard` to `StartMissionControl`.

Shape:

```ts
interface StartMissionTaskCard {
  title: string;
  status: StartMissionControlStatus;
  currentPhase: StartExecutionPhaseId;
  currentStep: StartExecutionCursor;
  markdown: string;
}
```

The field is additive. It does not remove `missionControl.resume`, `missionControl.handoff`, `missionControl.runbook`, or any CLI shortcut. `projscan_start` returns `computeStartReport`, so MCP clients receive the card automatically.

## Architecture

Move task-card rendering from the CLI command module into `src/core/start.ts`. `buildMissionControl` will construct the task card after the handoff prompt exists and before it returns the Mission Control object.

The CLI should stop owning the renderer. `projscan start --task-card` and `--save-mission` should read `report.missionControl.taskCard.markdown`. That keeps CLI, JSON, MCP, and bundle output identical.

The task-card Markdown should keep the current behavior:

- `# Mission Task Card`
- intent, status, and current step
- `## Do Next`
- `## Proof`
- `## Done When`
- `## Handoff Prompt`

Blocked follow-ups must keep the safer wording: `After inputs, run ...`.

## Alternatives

1. Keep the card CLI-only.
   This preserves a smaller core shape, but MCP users lose the main handoff artifact.

2. Add a new MCP option such as `include_task_card`.
   This reduces payload size for clients that do not need Markdown, but `projscan_start` already returns the runbook by default. The extra option adds branching without a clear payoff.

3. Add `missionControl.taskCard` by default.
   This gives every client the same artifact and keeps the API additive. This is the selected approach.

## Testing

Add failing tests before implementation:

- Core: `computeStartReport` exposes `missionControl.taskCard` with Markdown, current step, proof, done criteria, and the handoff prompt.
- MCP: `projscan_start` returns `start.missionControl.taskCard.markdown`.
- CLI: `--task-card` output equals the core `missionControl.taskCard.markdown`, and saved `task-card.md` writes the same Markdown.

Run the focused start suites, full test suite, lint, stability check, security gate, graph corpus check, and packed install smoke.

## Documentation

Update README and GUIDE to say `missionControl.taskCard.markdown` is available to JSON/MCP clients. Update CHANGELOG with the new field.

Use direct wording: agents get the same task card as CLI users.

## Self-Review

- No placeholders remain.
- The scope is one additive field and renderer relocation.
- The design keeps existing shortcuts and bundle files unchanged.
- The selected approach improves MCP usefulness without adding a new tool.
