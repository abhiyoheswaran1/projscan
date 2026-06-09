# Resume Proof Tool Calls Design

## Problem

`missionControl.resume.remainingProofCommands` gives resumed agents the proof queue after the current command, but it is still CLI-only. MCP agents can call the current resume action through `resume.toolCall`, then must parse shell commands to run proof through MCP.

## Product Goal

Expose MCP-native proof calls for the remaining proof queue. Agents should be able to run the current MCP tool call, resolve inputs, call follow-up templates, then run known proof tools without reverse-engineering CLI strings.

## Approach

Add optional `missionControl.resume.remainingProofToolCalls`, a best-effort array derived from the `run_proof` checklist items:

- `stepId` and `command` preserve the checklist/proof source.
- `tool` and `args` provide the MCP-native invocation.
- Only known safe command forms are mapped.
- Unknown commands stay available in `remainingProofCommands` and the checklist, but are omitted from `remainingProofToolCalls`.

Initial mappings cover the proof commands Mission Control already emits heavily:

- `projscan preflight --mode <mode> --format json`
- `projscan preflight --format json`
- `projscan understand --view <view> [--intent "..."] --format json`
- `projscan session touched --format json`

## Runbook And Docs

Render `MCP proof calls:` in the runbook resume section when these calls exist. Document that MCP agents should prefer `remainingProofToolCalls` and fall back to `remainingProofCommands` for unmapped commands.

## Testing

Add failing core, MCP, and CLI tests before implementation:

- JSON resume payload includes MCP proof calls for preflight and understand proof commands.
- The call entries preserve `stepId`, `command`, `tool`, and `args`.
- The call queue excludes the current command.
- Runbook Markdown and `--include-handoff` output render `MCP proof calls:`.
