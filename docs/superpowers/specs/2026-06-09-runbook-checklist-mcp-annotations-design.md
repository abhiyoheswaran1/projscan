# Runbook Checklist MCP Annotations Design

## Problem

`missionControl.resume.checklist` now carries MCP `tool` / `args` metadata for current, follow-up, and proof rows, but the Markdown runbook renders checklist rows as command-only text.

That means a runbook-only handoff still forces an agent or human to cross-reference `MCP call`, `MCP proof calls`, or JSON fields before calling tools directly.

## Goals

- Render MCP call annotations inline in Markdown `Resume checklist` rows when a checklist item has `tool` metadata.
- Keep command text first so existing human CLI flows remain easy to scan.
- Mark CLI-only proof rows as `CLI only`.
- Preserve the existing `MCP call`, `Proof queue`, and `MCP proof calls` sections for compatibility.

## Non-Goals

- Changing the JSON checklist schema.
- Removing existing runbook sections.
- Making blocked placeholder follow-ups runnable before inputs are resolved.
- Changing CLI command strings.

## Design

`formatRunbookChecklistItem` appends an action hint after the existing action:

```text
- [ready] run_current ready-1: projscan search "auth token loader" --format json (MCP: projscan_search {"query":"auth token loader"})
- [blocked] run_follow_up follow-up-1: projscan impact --symbol <symbol-from-search> --format json (MCP: projscan_impact {"symbol":"<symbol-from-search>"})
- [ready] run_proof proof-2: projscan preflight --mode before_edit --format json (MCP: projscan_preflight {"mode":"before_edit"})
- [ready] run_proof proof-6: projscan handoff (CLI only)
```

The annotation is informational: blocked rows still show blocked status and placeholders, and agents must resolve the listed inputs before executing them.

## Test Plan

- Extend core runbook tests to assert:
  - current checklist rows render MCP calls.
  - blocked follow-up checklist rows render MCP call templates with placeholders.
  - proof checklist rows render MCP calls.
  - CLI-only proof rows render `CLI only`.
- Extend CLI and MCP start tests to cover the externally visible runbook text.
- Run focused start suites, build, lint, full tests, and the usual stability/security/corpus/smoke gates.
