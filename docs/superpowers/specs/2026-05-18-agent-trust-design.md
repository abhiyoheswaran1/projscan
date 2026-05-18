# projscan 2.1 Agent Trust Design

Date: 2026-05-18

## Summary

projscan 2.1.0 should roll the next product arc into one focused release:
**Agent Trust**. The release promise is that projscan can tell an AI coding
agent whether it is safe to proceed, coordinate multi-agent work over a shared
repo state, make local policy plugins practical to author, and deepen PR review
signals where they protect edits.

This is a design spec, not release approval. Do not bump, tag, publish npm,
publish the MCP Registry descriptor, push, or update the website until the user
explicitly approves the final release step after implementation and verification.

## Product Goal

Make projscan the agent preflight and review substrate:

- before an agent edits, it can ask projscan what is risky right now
- before an agent commits or merges, it can ask whether the change is safe
- when several agents work in the same repo, they can share touched-file and
  risk context through projscan
- when a team has local policy, it can encode that policy through stable
  plugins rather than forking projscan

The user-facing story should be simpler than "28 tools":

> projscan tells agents whether it is safe to proceed.

## Release Shape

Ship this as one minor release:

- Version: `2.1.0`
- Theme: `Agent Trust`
- Compatibility: no breaking changes
- Primary new surfaces:
  - `projscan preflight`
  - `projscan_preflight`
  - `projscan://session/summary`
  - `projscan://handoff`
  - `projscan://risk-now`
  - `projscan plugin init`
  - `projscan plugin test`
  - contract/API diff additions to review payloads

The work is staged, but the release is one coherent product release. Each stage
must finish with focused bug hunting before the next stage begins.

## Non-Goals

- No SaaS dashboard.
- No IDE extension.
- No embedded LLM call.
- No generic Semgrep, Snyk, or SonarQube clone.
- No new language adapter unless a blocking implementation detail requires it.
- No remote plugin registry.
- No automatic plugin install from the network.
- No breaking change to existing MCP tool names, CLI command names, documented
  flags, exit code meanings, or 2.x JSON schema contracts.

## Product Principles

### Agent-first, human-readable second

The new surfaces should be small, structured, and cheap for agents to consume.
Console output can be useful, but the authoritative contract is JSON-compatible
data over CLI JSON and MCP.

### Verdicts need evidence

`proceed`, `caution`, and `block` are only useful if the agent gets the reason.
Every non-proceed verdict must include concrete evidence and a suggested next
tool call or command.

### Local trust boundary stays explicit

Plugins execute local code. Keep the explicit opt-in trust model. Improve plugin
authoring and testability without implying untrusted plugin code is sandboxed.

### Compose existing signals before inventing new analysis

The first implementation should reuse health, review, taint, impact, session,
changed-file, memory, and plugin-policy signals. Add deeper review intelligence
only where the existing graph already supports a reliable answer.

## Stage Gates

Every implementation stage must follow this loop:

1. Write or update focused tests first.
2. Implement the smallest coherent slice.
3. Run focused tests.
4. Run a stage-specific bug hunt.
5. Fix discovered bugs.
6. Run the focused tests again.
7. Update docs/changelog for that stage.
8. Stop and report the verification evidence before moving on.

After all stages, run a full cross-surface bug hunt and release-prep ritual.

## Stage 0: Contracts and Baseline

Before product code, lock down the intended public surfaces and test fixtures.

### Scope

- Define `PreflightMode = "before_edit" | "before_commit" | "before_merge"`.
- Define `PreflightVerdict = "proceed" | "caution" | "block"`.
- Define the preflight output shape:
  - `schemaVersion`
  - `mode`
  - `verdict`
  - `summary`
  - `reasons`
  - `evidence`
  - `requiredChecks`
  - `suggestedNextActions`
  - `toolCalls`
  - optional `truncated`
- Define session resource output shapes for summary, handoff, and current risk.
- Define plugin test fixture output shape.
- Define review contract-diff additions as optional fields on existing review
  structures.

### Acceptance

- Type definitions compile.
- Stability docs identify the new 2.1 surfaces as additions.
- Tests can import the new contract types before implementation.

### Bug Hunt

- Search for any proposed required field that would make future extension hard.
- Check whether each new field is useful to an agent without reading prose.
- Verify no existing stable surface is renamed or repurposed.

## Stage 1: Agent Safety Gate

Build the product wedge: one preflight command/tool that answers whether an
agent should proceed.

### CLI

Add:

```bash
projscan preflight
projscan preflight --mode before_edit
projscan preflight --mode before_commit
projscan preflight --mode before_merge
projscan preflight --format json
```

Console output should be compact. JSON is the primary machine contract.

### MCP

Add `projscan_preflight` with the same modes.

### Verdict Rules

Initial conservative rules:

- `block`
  - new taint flow in review mode
  - health errors on changed files before commit/merge
  - plugin policy issue with severity `error`
  - review verdict is `block`
- `caution`
  - health warnings on changed files
  - review verdict is `review`
  - touched files overlap high-risk hotspots
  - Project Memory marks surfaced rules as noisy or historically tolerated
  - impacted files exceed a configured or default threshold
- `proceed`
  - no blocking conditions
  - no caution conditions
  - required checks are available or explicitly marked unavailable with a
    non-blocking reason

### Evidence

Preflight should compose existing data:

- `doctor` issue summary
- changed-file availability
- `review` verdict when refs are available
- taint changes when review can compute them
- session touched files
- hotspot overlap
- plugin policy issues
- memory confidence and severity drift

### Suggested Next Actions

Each non-proceed result should include actionable next steps, for example:

- call `projscan_review` with the same refs
- call `projscan_fix_suggest` for a specific issue id
- call `projscan_impact` for a specific file or symbol
- run `projscan plugin list` if plugin policy is unavailable
- run with `--base-ref` if changed-file detection was ambiguous

### Acceptance

- CLI and MCP return matching verdict logic for the same fixture.
- JSON includes `schemaVersion`.
- Unsupported `--format` combinations follow the shared format matrix.
- `before_edit` works outside a git repo and degrades to health/session signals.
- `before_commit` and `before_merge` explain unavailable git refs rather than
  crashing.

### Bug Hunt

- Fixture with no git repo.
- Fixture with clean git repo.
- Fixture with changed file and one health warning.
- Fixture with plugin error.
- Fixture with plugin policy issue.
- Fixture with new taint flow.
- Fixture with unavailable base ref.
- JSON stdout remains parseable when warnings go to stderr.

## Stage 2: Multi-Agent Coordination

Extend Session from "what has been touched" into "what should agents know before
they collide."

### Resources

Add MCP resources:

- `projscan://session/summary`
- `projscan://handoff`
- `projscan://risk-now`

These should be readable without a separate tool call and should stay budget
aware.

### Session Summary

Summarize:

- current session id
- touched files by source
- recently surfaced issues
- high-risk touched files
- plugin policy hits
- stale or unavailable signals

### Handoff

Produce a concise handoff payload for another agent:

- what files were touched
- why those files matter
- what risks remain
- what tool calls should happen next
- what not to repeat

### Risk Now

Surface current repo risk from the perspective of coordination:

- multiple touched files in one import chain
- touched files in the same workspace package
- touched files connected by reverse import impact
- touched files participating in taint paths
- touched files that are high-risk hotspots

### Conflict Detection

Add deterministic conflict reasons:

- `same-file`
- `import-related`
- `same-workspace`
- `taint-related`
- `hotspot-overlap`

This is not identity tracking. projscan does not need to know which human or
agent edited a file to identify coordination risk.

### Acceptance

- Resources list includes the three new URIs.
- Resources read returns stable JSON-compatible content.
- Conflict detection works from session touched-file data.
- No resource requires network or LLM calls.

### Bug Hunt

- Empty session.
- Session with one touched file.
- Session with two import-related files.
- Session with touched files in different workspaces.
- Session reset followed by resource reads.
- Large touched-file list with truncation.

## Stage 3: Plugin Ecosystem DX

Make the stable plugin contract easy to adopt.

### CLI

Add:

```bash
projscan plugin init
projscan plugin init --kind analyzer
projscan plugin init --kind reporter
projscan plugin test .projscan-plugins/policy.projscan-plugin.json
```

### Plugin Init

`plugin init` should write a minimal manifest and module into `.projscan-plugins/`.
It should refuse to overwrite existing files unless a future explicit flag is
added. The generated code should be small, local, and easy to edit.

Analyzer template:

- emits one example `info` issue only when it finds an obvious marker string
- includes a relative location when possible
- returns `[]` by default for normal files

Reporter template:

- supports `doctor`, `analyze`, and `ci`
- returns a concise text summary
- demonstrates payload handling without assuming every payload has the same
  fields

### Plugin Test

`plugin test` should:

- validate manifest
- load the module when plugin execution is enabled for the test process
- run analyzer plugins against a fixture root
- run reporter plugins against sample payloads
- report diagnostics with the same structured codes as runtime loading

The test runner should support a default generated fixture and an explicit
fixture path.

### Examples

Add tested examples for:

- forbidden imports
- architecture layer policy
- ownership/team metadata policy
- release checklist reporter

### Acceptance

- `plugin init` creates valid analyzer and reporter plugins.
- `plugin test` catches missing module, syntax error, missing export, malformed
  issue, unsupported reporter command, and non-string reporter output.
- Example plugins are covered by tests.
- Packed-install smoke covers plugin test or at least confirms generated plugin
  loading outside the repo checkout.

### Bug Hunt

- Existing plugin dir absent.
- Existing plugin dir present.
- Existing target manifest already exists.
- Analyzer returns malformed issue.
- Reporter throws.
- Plugin test run from packed install.
- JSON output for plugin test remains parseable.

## Stage 4: Deeper Review Intelligence

Deepen review where it directly helps an agent avoid unsafe edits.

### Contract/API Diff

Add optional review fields for:

- exported symbol added
- exported symbol removed
- exported symbol renamed when confidence is high
- function signature changed when parseable
- package entrypoint changed
- public package export changed

Keep the shape additive. Do not change existing `projscan_review` fields.

### Why This Matters

For each high-signal review finding, add a concise explanation:

- what changed
- why it can break downstream code
- what the agent should inspect next

This must be rule-driven. No embedded LLM.

### Hot-Path Dataflow

Only add dataflow depth where it strengthens review:

- new source-to-sink path already blocks
- touched files on existing taint paths should create caution
- signature changes to functions in taint paths should create caution

Avoid building a general SAST engine.

### Acceptance

- Existing review tests still pass.
- Contract diff appears only when relevant.
- Signature diff degrades gracefully when a language adapter cannot parse
  parameter details.
- Package entrypoint changes are detected for common Node package fields:
  `main`, `module`, `types`, `exports`, and `bin`.
- Review payload additions are documented as optional 2.1 fields.

### Bug Hunt

- Export added only.
- Export removed only.
- Rename-like export change.
- Function body changed but signature unchanged.
- Signature changed in JS/TS and at least one non-JS language where supported.
- `package.json` entrypoint changed.
- Monorepo package entrypoint changed.
- Large PR with many export changes and budget truncation.

## Final Bug Hunt and Release Ritual

After all stages:

1. Run full unit and integration tests.
2. Run focused preflight, session resource, plugin DX, and review-intelligence
   suites.
3. Run packed-install smoke.
4. Run Node 18, Node 20, and the current local Node runtime sanity checks.
5. Run `npm audit --audit-level=moderate`.
6. Run `npm run check:stability`.
7. Run projscan against itself:
   - `doctor --format json`
   - `preflight --format json`
   - `plugin test` on documented examples
8. Validate MCP Registry descriptor.
9. Update README, Guide, Stability, Roadmap, Changelog, plugin docs, website
   prompt, and screenshots if user-visible CLI output changed.
10. Stop and wait for explicit release approval.

## Documentation Plan

Update docs in the same staged order:

- README: lead with Agent Trust and `projscan preflight`.
- Guide: add preflight workflow and multi-agent coordination section.
- Stability: add new stable CLI/MCP/resource surfaces.
- Plugin Authoring: add init/test workflow.
- Roadmap: move Agent Trust into the current release arc.
- Changelog: keep an Unreleased 2.1 section until bump/release approval.
- Website prompt: replace generic Plugin Platform copy with Agent Trust copy.

## Success Criteria

2.1.0 is successful if:

- a coding agent can call one tool and decide whether to proceed
- a human can understand the same verdict from CLI output
- multi-agent sessions expose coordination risk without extra setup
- plugin authors can generate, test, and debug a plugin without reading source
- review output catches public contract changes that ordinary textual diff
  summaries often miss
- the release remains offline-first, local-first, and MCP-native

## Open Product Decisions

These are intentionally resolved for this release:

- Release as one minor version: yes, `2.1.0`.
- Put the product wedge on preflight: yes.
- Keep plugin execution opt-in: yes.
- Add more languages: no.
- Add SaaS/dashboard/IDE/LLM features: no.

## Stop Condition

When this spec is accepted, write an implementation plan broken into the same
stages. Implementation should not begin until the plan exists and the user has
approved moving from design into execution.
