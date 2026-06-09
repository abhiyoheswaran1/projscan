# Resume Input Bindings Design

## Problem

Mission Control resume payloads can now expose the current MCP tool call and follow-up templates. The follow-up templates still contain placeholders such as `<symbol-from-search>`, while the resume unlock references only expose the input step labels and instructions. A resumed agent can infer the substitution path, but the machine-readable contract does not say which placeholder maps to which input step.

## Product Goal

Make resumed work easier to automate by turning placeholder substitution into explicit data. The resume payload should let an MCP agent run the current command, read the unlocked input bindings, fill the matching placeholders, and call the follow-up templates without traversing the full execution plan.

## Approach

Carry the original placeholder onto `input` execution-plan steps, then reuse that metadata in resume references. Add a compact `missionControl.resume.inputBindings` array that connects each unlocked input to the follow-up templates it enables:

- `inputId`, `label`, `placeholder`, and `instruction` describe the value to collect.
- `followUpIds` lists the template steps that should receive the collected value.
- Existing `resume.unlocks`, `resume.followUps`, handoff, and runbook structures stay backward-compatible.

The runbook will render a short `Template inputs` section so humans see the same mapping:

```text
Template inputs:
- <symbol-from-search> -> input-1 (symbol): Replace <symbol-from-search> with an exported symbol returned by the search step.
```

## Data Flow

`missionUnresolvedInputs` already extracts placeholder metadata. `buildMissionExecutionPlan` will preserve the placeholder on each `resolve_inputs` step. `missionResume` will derive bindings from the current cursor unlocks, including follow-up ids from the input step `unlocks` list.

## Testing

Add failing tests first for core, MCP, and CLI surfaces:

- execution-plan input steps include `placeholder`;
- `resume.unlocks` includes placeholder metadata for input references;
- `resume.inputBindings` is copied through handoff and runbook payloads;
- runbook Markdown and `--include-handoff` console output render `Template inputs`.
