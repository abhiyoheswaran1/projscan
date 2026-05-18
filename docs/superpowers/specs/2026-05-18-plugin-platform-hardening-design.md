# Plugin Platform Hardening Design

Date: 2026-05-18

## Summary

The next substantial development direction for projscan is to harden the 1.10
analyzer plugin preview into a credible 2.0 platform contract. The work should
make third-party analyzer plugins practical to build, validate, diagnose, and
run without making projscan less safe or less predictable.

This is development prep for a future release, not release prep. This design
does not include a version bump, git tag, npm publish, GitHub Release, MCP
Registry publish, or website update.

## Context

The roadmap says the 1.4 through 1.10 agent-substrate arc is complete and the
next major target is 2.0.0, centered on a stable Plugin API. Version 1.10.0
already introduced a gated analyzer plugin preview:

- `src/core/plugins.ts` discovers and validates `.projscan-plugins/*.projscan-plugin.json`.
- `projscan plugin list | validate` exposes discovery and validation in the CLI.
- `projscan_plugin` exposes the same surface to MCP clients.
- `PROJSCAN_PLUGINS_PREVIEW=1` gates loading and execution.
- Plugin analyzer issues merge into the built-in issue stream for `doctor`,
  `ci`, and `analyze`.

The preview is useful but not yet platform-grade. It needs stronger contract
documentation, more precise validation, better diagnostics, fixture coverage
through the full issue pipeline, and explicit release guardrails.

## Product Goal

Make plugin authors confident that a plugin they write today has a clear path
to the 2.0 stable contract, while keeping projscan users safe from accidental
or poorly-shaped plugin behavior.

## Engineering Goals

1. Keep plugins opt-in until 2.0 finalization.
2. Make manifest validation precise enough that users can fix problems without
   reading projscan internals.
3. Prove plugin analyzer issues flow through `doctor`, `ci`, and `analyze`.
4. Keep plugin failures isolated from built-in analyzers and other plugins.
5. Keep the public stable surface compatible with the 1.x stability contract:
   additions are allowed, removals and required-argument changes are not.
6. Document the release process separately from development work so version
   bumping and publishing happen only when explicitly requested.

## Non-Goals

- No version bump.
- No git tag.
- No npm publish.
- No GitHub Release creation.
- No MCP Registry republish.
- No website update.
- No removal of deprecated 1.x helpers in this phase.
- No LLM execution inside projscan.
- No codemod or plugin write-action API.
- No remote plugin registry.
- No plugin installation command.

## Recommended Scope

### 1. Stable Preview Contract

Define the plugin manifest contract in one internal module and one user-facing
document. The contract remains gated by `PROJSCAN_PLUGINS_PREVIEW`, but its
fields should be explained as the intended 2.0 shape.

Manifest fields:

- `schemaVersion`: must be `1`.
- `name`: stable plugin identifier used in issue id prefixes.
- `kind`: currently `analyzer`.
- `module`: relative path inside the plugin directory.
- `category`: fallback `Issue.category`.
- `description`: optional human-readable summary.

The design should not add new required manifest fields. Optional fields are
acceptable if they solve a concrete need, but the first implementation pass
should prefer better validation and documentation over schema expansion.

### 2. Validation and Diagnostics

Improve validation results so both CLI and MCP can surface structured details.
The current `reason: string` is usable, but the next implementation should
prefer a small diagnostic shape:

- `code`: stable machine-readable error code.
- `message`: concise human-readable explanation.
- `field`: manifest field when applicable.
- `hint`: fix guidance when useful.

CLI output should remain readable in console mode. JSON output should expose
structured diagnostics. MCP output should expose the same diagnostics so agents
can repair manifests deterministically.

Expected validation examples:

- Invalid JSON reports `invalid-json`.
- Missing required fields identify the exact field.
- Unsupported `schemaVersion` reports expected and received values.
- Unsupported `kind` reports the allowed set.
- Unsafe `module` paths explain that modules must stay inside the plugin
  directory.
- Invalid `name` explains the allowed character set and length.

### 3. Full Pipeline Proof

Add fixture-level tests proving plugins participate in the analyzer pipeline
when the preview flag is enabled:

- `doctor` includes plugin issues.
- `ci` includes plugin issues and respects severity in score/exit behavior.
- `analyze` includes plugin issues.
- When the flag is disabled, the same manifest is discoverable but inactive.

The test plugin should live inside a temporary fixture directory created by the
test. It should return deterministic issues with a relative file location when
possible, so output integration can be asserted without relying on snapshots.

### 4. Failure Isolation

The implementation should preserve and extend existing isolation behavior:

- One plugin throwing during `check` does not fail the run.
- One plugin returning malformed issues does not poison the issue stream.
- One plugin failing to load does not prevent other plugins from loading.
- Built-in analyzers continue to run even when plugin discovery or execution
  has bad inputs.

Diagnostics for skipped plugins should be visible in CLI/MCP plugin tooling.
The main `doctor` / `ci` / `analyze` paths should stay quiet unless a plugin is
enabled and fails during runtime; runtime warnings should go to stderr so JSON
stdout stays parseable.

### 5. Security Boundary

The plugin API intentionally executes local code, so the security boundary is
not "plugins are safe." The boundary is:

- projscan never fetches remote plugin code.
- manifests are discovered only under `.projscan-plugins/`.
- `module` cannot be absolute and cannot traverse outside the manifest
  directory.
- plugin output is shape-checked before merging into issues.
- plugin failures are isolated.
- preview execution is off unless `PROJSCAN_PLUGINS_PREVIEW=1` or `true`.

The docs should state that enabling plugins means trusting local plugin code in
the repository, the same way running project scripts means trusting project
code.

### 6. Documentation

Add a user-facing plugin author guide:

- where plugin manifests live
- minimal manifest example
- minimal analyzer module example
- issue object requirements
- how issue ids are prefixed
- how to validate a manifest
- how to list plugins
- how to enable the preview
- how plugin issues enter `doctor`, `ci`, and `analyze`
- security and trust model
- compatibility note for 2.0

Link it from `README.md`, `docs/GUIDE.md`, and `docs/ROADMAP.md` where the
plugin API is already described.

### 7. Release Process Awareness

Do not perform release prep during this feature build. Add or update developer
notes only if they reduce future release risk.

When release prep is later requested, the required process is:

1. Bump `package.json#version`.
2. Bump both version fields in `.github/mcp-registry/server.json`.
3. Add a top `CHANGELOG.md` section for the new version.
4. Sweep README, guide, roadmap, and stability docs for tool counts, language
   counts, and changed public-surface claims.
5. Regenerate the dogfood health badge.
6. Run full verification: install/build/test/lint/stability/projscan health.
7. Tag `vX.Y.Z` only after the prep is reviewed.
8. Let GitHub Actions publish npm and create the GitHub Release.
9. Manually republish the MCP Registry and update website expectations after
   the workflow succeeds.

## Architecture

The implementation should preserve the current architecture:

- `src/core/plugins.ts` owns manifest validation, discovery, loading, execution,
  and issue shape checks.
- `src/cli/commands/plugin.ts` formats plugin discovery and validation for
  human and JSON CLI output.
- `src/mcp/tools/plugin.ts` exposes discovery and validation to agents.
- `src/core/issueEngine.ts` is the single integration point that folds plugin
  issues into built-in analyzer results.
- Tests under `tests/core` should cover pure plugin behavior and pipeline
  integration.

If validation diagnostics become richer, keep the diagnostic types in
`src/core/plugins.ts` unless they begin to be reused broadly. Avoid a new
abstraction until multiple modules need it.

## Data Flow

Discovery:

1. Find `.projscan-plugins/` under the repo root.
2. Read files ending in `.projscan-plugin.json`.
3. Parse JSON.
4. Validate shape and security-sensitive paths.
5. Return entries with either a manifest or diagnostics.

Execution:

1. Check the preview flag.
2. Discover manifests.
3. Resolve each module relative to its manifest file.
4. Dynamically import the module.
5. Require a `check(rootPath, files)` export.
6. Run each plugin with the current file list.
7. Shape-check returned issues.
8. Prefix issue ids as `plugin:<name>:<local-id>`.
9. Merge valid plugin issues into the issue stream.

## Error Handling

Validation errors should be data, not thrown exceptions. Plugin tooling should
report every bad manifest it can find instead of failing on the first one.

Runtime plugin errors should be isolated per plugin. The analyzer pipeline
should continue and emit a stderr warning that names the plugin and failure
class without dumping excessive stack output.

JSON stdout must remain parseable for commands that support JSON output.

## Testing Strategy

Use test-driven implementation. The first failing tests should cover:

- structured validation diagnostics
- CLI JSON output for invalid manifests
- MCP validation output for invalid manifests
- plugin issue flow through the health pipeline
- preview-disabled behavior
- runtime failure isolation

Required final verification before claiming implementation complete:

- `npm test`
- `npm run lint`
- `npm run build`
- `npm run check:stability`
- `node ./dist/cli/index.js doctor --format json --quiet`
- targeted plugin CLI smoke tests using a temporary fixture

If any command fails because of existing unrelated state, document the exact
failure and do not release.

## Open Decisions

The first implementation should not require user decisions. A later release
prep pass will need a semver decision from the user before any bump or tag.
