# Recontract Guidance Automation Design

## Goal

Make `projscan proof-broker` and `projscan review-gate` turn missing-contract and
scope-drift states into a bounded next step for the active worktree instead of a
generic stop message.

Today the product correctly detects drift, but the handoff is too manual. In a
worktree-driven loop, the tool already knows the effective worktree, the drift
files, and the proof commands that remain. The missing piece is a structured,
reviewer-safe recontract guide that tells the agent exactly how to restart with
the right boundary.

## Product Bet

The better dogfood outcome is not "a careful maintainer can recover from drift."
It is "ProjScan itself reduces the amount of manual recovery needed when drift
or missing-contract state appears."

This slice should improve the next-major trust loop without adding hidden writes
or autonomous approval behavior.

## Approaches Considered

### 1. Repo-local operational hygiene only

Tighten task contracts and proof docs for this repo so the proof worktree
reaches a clean state with existing commands.

Rejected because it proves discipline, not product value. The current failure is
in product ergonomics.

### 2. Suggestion-only automation

Keep `proof-broker` and `review-gate` read-only, but add richer structured
recontract guidance with worktree-aware command suggestions and a likely scoped
contract path.

This is the chosen approach for this slice.

### 3. Contract-bootstrap automation

Let `proof-broker` or `review-gate` create a fresh scoped Proof Contract during
intent evaluation when the current worktree has drifted.

Deferred. It is promising, but it expands write behavior and public command
semantics more than this slice needs.

## Desired Outcome

When `proof-broker` or `review-gate` sees `missing-contract` or scope drift, the
report should answer four questions directly:

1. Which worktree is this about?
2. Why is the current boundary unusable?
3. Which contract path should the agent create next?
4. Which exact commands should the agent run next?

The output should stay advisory. Users must still run `projscan prove` or other
commands explicitly.

## Scope

This slice is limited to Proof Broker and Review Gate surfaces that already
carry recontract guidance.

In scope:

- richer structured recontract guidance in core types and reports
- effective-worktree-aware recommended contract path and follow-up commands
- reuse of caller-supplied `--intent` when present
- JSON, console, Markdown, and PR-comment output updates
- focused tests and dogfood evidence

Out of scope:

- automatic Proof Contract creation
- automatic task generation
- mutation of changed files or task boundaries
- new release automation, publishing, or version bumps

## Public Behavior

### Current behavior

`proof-broker` and `review-gate` expose recontract state, but the guidance is
too generic:

- `required: true`
- a broad reason string
- one placeholder command

That forces the agent to reconstruct intent, pick a contract path, and infer the
next sequence manually.

### New behavior

The recontract section becomes a first-class advisory object with enough detail
to restart the proof loop cleanly.

`proof-broker` and `review-gate` should include:

- `required`
- `reason`
- `target`
- `driftFiles`
- `recommendedIntent`
- `recommendedContractPath`
- `followUpCommands`

When the caller supplies `--intent`, `recommendedIntent` should use that exact
text instead of a placeholder.

When no explicit intent exists, `recommendedIntent` may remain a placeholder,
but the commands should still be concrete about the contract path and replay
sequence.

## Data Model

Add a shared recontract guidance shape used by Proof Broker and Review Gate.

Proposed fields:

```ts
type RecontractGuidance = {
  required: boolean;
  reason: string;
  target: {
    effectiveWorktreePath: string;
    effectiveWorktreeBranch: string | null;
    effectiveWorktreeHead: string | null;
  };
  driftFiles: string[];
  recommendedIntent: string | null;
  recommendedContractPath: string;
  followUpCommands: string[];
};
```

Notes:

- `recommendedContractPath` is advisory and should default to
  `.projscan/proof-contract.json` unless a stronger local pattern is already
  present in the invoked command.
- `followUpCommands` should be ordered for the restart loop, for example:
  1. `projscan prove --intent ... --save-contract <path>`
  2. `projscan assess --mode fix-first --format json` when still required
  3. `projscan preflight --mode before_commit --format json` when still required
  4. `projscan prove --changed --contract <path> --format markdown`
  5. `projscan passport --contract <path> --format markdown`
  6. `projscan proof-broker --contract <path> --pr-comment`
  7. `projscan review-gate --contract <path> --pr-comment`

The exact list should be assembled from existing evidence instead of being
hard-coded blindly. Missing proof commands should appear before replay and
handoff commands.

## Recommended Contract Path Rules

This slice should stay conservative.

1. If the current invocation already points at a contract path, preserve it.
2. Otherwise default to `.projscan/proof-contract.json`.
3. Do not invent per-branch file names automatically in this slice.
4. Keep path validation identical to existing Proof Contract path rules.

This keeps the advisory path predictable and avoids introducing naming policy as
an accidental product contract.

## Architecture

The implementation should extend the existing core projection layers rather than
adding new command families.

### Proof Broker

`computeProofBroker()` should build the richer recontract object from:

- the effective worktree target
- scope status
- outside-allowed drift files
- contract path inputs
- proof missing-command state
- optional caller intent

### Review Gate

`computeReviewGate()` should reuse the Proof Broker recontract guidance instead
of recomputing it independently. Review Gate may append its own final
`review-gate` follow-up command when useful for reviewer output.

### Renderers

Markdown and PR-comment renderers should add a short recontract section:

- whether recontract is required
- why
- target worktree
- recommended contract path
- next commands

Keep the section compact. The goal is clarity, not another large report block.

## CLI Semantics

This slice does not add new flags.

Existing flags should behave as they do now:

- `--intent` continues to create or refresh a contract only where already
  supported.
- `--contract` continues to read an existing contract.
- `--pr-comment` continues to print reviewer-facing Markdown.
- `--format json` continues to return the structured object.

The change is that the emitted guidance becomes materially more useful when the
status is `missing-contract`, `drifted`, or otherwise requires recontract.

## Error Handling and Safety

- No hidden file writes.
- No background contract creation.
- No mutation of task files or proof ledger records.
- No widening of contract scope.
- No change to proof command execution rules.
- No change to MCP execution policy; MCP remains evidence-only.
- If no intent is available, keep the intent placeholder explicit rather than
  guessing from changed files.

The guidance must remain safe to show in CI or PR comments without implying that
review may proceed.

## Documentation

Update the local docs that explain Proof Broker and Review Gate:

- `docs/GUIDE.md`
- any public prompt or command reference that currently shows a placeholder-only
  recontract path

The docs should explain that:

- the tools now emit a concrete recontract recipe
- the recipe is worktree-aware
- the recipe is advisory and still requires explicit command execution

## Testing

Focused coverage is enough for this slice.

Core tests:

- Proof Broker emits enriched recontract guidance for missing-contract state.
- Proof Broker reuses explicit intent text when provided.
- Proof Broker preserves an explicit contract path when provided.
- Review Gate reuses Proof Broker recontract guidance and exposes it unchanged
  except for any deliberate extra follow-up command.
- Follow-up command ordering stays deterministic.

CLI tests:

- JSON output includes the richer recontract object.
- Markdown or PR-comment output includes target worktree, contract path, and
  next commands.
- Worktree-targeted invocations still report the effective worktree correctly in
  the recontract section.

Dogfood:

- from the proof worktree, `proof-broker --format json` should show a concrete
  recontract recipe instead of only a placeholder command
- from the same worktree, `review-gate --format json` should show the same
  target-aware recontract recipe

## Acceptance Criteria

- Missing-contract and drift states expose structured recontract guidance with a
  target, recommended contract path, and ordered follow-up commands.
- Caller-supplied intent is preserved in recontract guidance.
- Review Gate stays consistent with Proof Broker rather than diverging.
- Public output remains advisory and non-mutating.
- Focused tests pass and dogfood evidence from the linked proof worktree shows
  the improved restart loop.

## Stop Conditions

Stop and ask before continuing if:

- the existing public type surface would need a breaking rename,
- preserving explicit contract paths proves inconsistent with current path
  validation,
- docs imply automatic contract creation rather than guidance,
- the slice expands into auto-write behavior.

## Release Constraint

This is a no-release proof-phase slice. Do not bump the package version, tag,
publish, deploy, or prepare release artifacts here.
