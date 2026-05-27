# 3.0.2 Agent Graph Readiness Design

## Goal

Ship one patch release that makes projscan more trustworthy as the code-intelligence substrate for agents: graph quality is gated, dataflow custom rules stay visible, cross-repo impact shows ownership, and release planning reflects the 3.x graph platform.

## Scope

This release is additive and patch-safe. It does not remove or rename CLI commands, MCP tools, JSON keys, or stable schemas. The batch includes:

1. Preserve custom dataflow sources/sinks when broad file-I/O filtering is active.
2. Add graph corpus checks to local release readiness, CI, and release workflow gates.
3. Harden `release:check` so an existing remote version tag must point at the current release commit before it is considered actionable.
4. Add lightweight ownership resolution for cross-repo impact boundary summaries using CODEOWNERS-style files.
5. Refresh `release-train` planning so 3.x graph-platform lines are first-class.
6. Bump release metadata to 3.0.2 and document the changes.

## Design

### Dataflow Filtering

`dataflowFilters` currently suppresses broad file-I/O risks too aggressively. A risk involving a default broad source or sink should be suppressed only when both sides are default broad file-I/O style. If either side came from user-supplied `sources` or `sinks`, it must remain visible because the user deliberately asked to track it.

### Graph Corpus Gate

`check:graph-corpus` already exists and compares fixture metrics against a baseline. 3.0.2 wires it into:

- `scripts/release-check.mjs` gate list.
- `.github/workflows/ci.yml`.
- `.github/workflows/release.yml`.

The gate runs after build/stability so `dist/core/graphCorpus.js` exists.

### Release Tag Integrity

`release:check` already enforces main-only tagging locally. It also needs to treat a remote tag that points somewhere other than `HEAD` as blocked, not merely “already exists”. For annotated tags, it should compare the peeled `refs/tags/vX.Y.Z^{}` commit when available.

### Impact Ownership

Cross-repo `boundarySummary.owner` should prefer ownership metadata instead of always using the repo name. Add a small ownership reader that checks `CODEOWNERS`, `.github/CODEOWNERS`, and `docs/CODEOWNERS`. It supports exact paths, prefix-ish directory patterns, and `*` wildcards well enough for agent routing. If no owner matches, keep the repo name fallback.

### Release Train

`releaseTrain` should understand `3.0.x` and `3.1.x` lines as graph-platform work so agents using the product planning tool get current guidance.

## Testing

- TDD unit tests for dataflow custom sink visibility.
- Release-check unit tests for graph-corpus gate invocation and remote mismatched tag blocking.
- Impact unit tests for CODEOWNERS-derived boundary owners.
- Release-train tests for 3.x lines.
- Full verification before merge/release: build, test, lint, stability, security release gate, graph corpus, packed install smoke, release check.

## Release Process

Implementation happens on a feature branch. The branch is opened as a PR, CI must pass, the PR is merged into `main`, then `npm run release:check` runs from clean current `main`. Only after main CI is green do we tag `v3.0.2` from `main` and publish through the GitHub release workflow.
