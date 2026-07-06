# Assisted Bootstrap Proof Loop Design

## Goal

Make `projscan proof-broker` and `projscan review-gate` able to create the next
scoped Proof Contract explicitly when the current worktree is missing-contract
or drifted, so the review loop can move from "I can tell you what to do" to
"I can create the next bounded contract when you ask."

This is the slice that justifies the `5.x` boundary. It changes workflow
semantics in a deliberate, user-controlled way by allowing reviewer-facing
surfaces to write a new Proof Contract rather than only describing one.

## Product Bet

The current product already understands:

- the effective worktree,
- the change set,
- the drift condition,
- the next proof commands,
- the likely contract path.

In the current loop, all of that ends in advice. That is useful, but it still
forces the agent or maintainer to drop down into a separate `projscan prove`
step and restate the bootstrap action manually.

For `5.x`, the next trust gain is explicit bootstrap:

- the user asks a review surface to mint the next scoped contract,
- projscan writes that contract through the same safe Proof Contract path rules,
- the output pivots immediately to the new post-bootstrap proof loop.

The change must remain explicit, local, and reviewable. This is not autonomous
scope widening.

## Approaches Considered

### 1. Release `5.0` with advisory recontract only

Rejected. The recent recontract guidance slice is a good additive improvement,
but it does not earn a major by itself.

### 2. Automatic bootstrap on drift

`proof-broker` or `review-gate` would write a new contract automatically when
`--intent` is present and the worktree is drifted or missing-contract.

Rejected for this first write-semantic step. It is too easy to hide contract
creation inside a reporting command.

### 3. Explicit assisted bootstrap on both review surfaces

Add an explicit bootstrap flag or mode to `proof-broker` and `review-gate`.
Those commands may create a new scoped contract only when the caller opts in.

This is the chosen approach.

## Desired Outcome

When a worktree is `missing-contract` or drifted, the user can choose one of
two review-surface paths:

1. advisory mode: inspect what needs to happen next,
2. bootstrap mode: write the next scoped contract immediately and receive the
   post-bootstrap next commands.

After bootstrap, the command should return:

- current status before bootstrap,
- bootstrap action taken,
- written contract path,
- contract summary,
- post-bootstrap proof commands,
- follow-up reviewer commands.

## Scope

In scope:

- explicit contract bootstrap on `proof-broker`
- explicit contract bootstrap on `review-gate`
- shared core helper that reuses existing `prove` contract generation/writing
- stable JSON report additions for bootstrap outcomes
- console, Markdown, and PR-comment output for bootstrap results
- focused tests, bug pass, and release-prep gate design

Out of scope:

- automatic bootstrap without explicit user opt-in
- hidden scope widening
- automatic proof-command execution
- MCP proof execution
- release tagging or publishing in this spec

## Public Behavior

### Existing behavior

`proof-broker` and `review-gate` can explain that a new contract is needed and
can recommend a contract path plus next commands.

### New behavior

Both commands gain an explicit bootstrap mode. Example shape:

```bash
projscan proof-broker --intent "<change>" --bootstrap-contract
projscan review-gate --intent "<change>" --bootstrap-contract
```

The bootstrap flag is part of the intended public CLI surface for `5.x`. Its
semantics are:

- only valid when an `--intent` is present,
- may write a Proof Contract using existing safe path rules,
- should default to `.projscan/proof-contract.json` unless an explicit
  `--save-contract` path is supplied,
- returns the new contract path and updated next commands,
- does not execute proof commands,
- does not auto-approve review.

## Why Both Surfaces

`proof-broker` and `review-gate` serve different loop entry points:

- `proof-broker` is the proof-first handoff for agents already gathering
  evidence.
- `review-gate` is the reviewer-facing decision surface that translates proof
  state into review debt and next action.

The bootstrap ability should exist in both because both surfaces already answer
"what should happen next?" The major-version improvement is that both can now
perform the bounded contract-write step when explicitly asked.

## CLI Surface

Add an explicit bootstrap flag to both commands.

Preferred semantics:

- `--bootstrap-contract`: generate and write a fresh Proof Contract using the
  supplied intent and the command's current contract-path inputs.

Rules:

1. `--bootstrap-contract` requires `--intent`.
2. `--bootstrap-contract` is invalid with `--contract` in this slice. Path
   selection for bootstrap uses `--save-contract`.
3. `--save-contract` remains the explicit output path override.
4. If the user does not provide `--save-contract`, bootstrap writes to
   `.projscan/proof-contract.json`.
5. Bootstrap should be available in `console`, `json`, and Markdown/PR-comment
   paths.

The command should remain read-only unless `--bootstrap-contract` or an existing
write flag like `--output-passport` / `--output` is supplied.

## Data Model

Add a shared bootstrap result shape used by both reports.

Proposed additive report field:

```ts
type BootstrapContractResult = {
  attempted: boolean;
  wroteContract: boolean;
  contractPath?: string;
  intent: string;
  summary?: string;
  followUpCommands: string[];
};
```

Add it as an optional field:

- `proofBroker.bootstrap?`
- `reviewGate.bootstrap?`

Interpretation:

- `attempted: false`: normal advisory path, no bootstrap requested.
- `attempted: true`, `wroteContract: true`: explicit bootstrap succeeded.
- `attempted: true`, command error: invalid input or path error should fail the
  command rather than returning a fake success object.

The existing `recontract` field remains. It still describes whether recontract
is required and what the restart loop looks like. `bootstrap` adds the explicit
write outcome.

## Architecture

The contract writer should remain owned by the existing `prove` path.

### Core Principle

Do not reimplement contract creation in `proof-broker` or `review-gate`.

Instead:

1. use the existing proof-contract generation path from `computeProve(..., {
   intent, saveContractPath })`,
2. reuse the resulting contract artifact and path,
3. rebuild the broker/gate report against the new contract path.

### Suggested Flow

For bootstrap mode:

1. resolve worktree target,
2. validate bootstrap inputs,
3. call the existing prove contract-generation path with `intent` and optional
   `saveContractPath`,
4. get the written contract path from the `prove` result,
5. rerun the normal broker/gate computation against that new contract path,
6. attach the `bootstrap` outcome to the final report,
7. return console/JSON/Markdown using the updated report.

This keeps one contract-generation engine and one path-validation policy.

## Report Behavior After Bootstrap

After bootstrap, the command should report the newly scoped state, not only the
pre-bootstrap missing-contract state.

That means:

- `requiredProof` should reflect the new contract where possible,
- `nextCommands` should pivot to the post-bootstrap proof loop,
- `recontract` may still be `required` if the current diff is broader than the
  new contract or if the worktree is still drifted,
- `bootstrap` should make it clear that contract creation was attempted and
  succeeded.

If the new contract still leaves the worktree drifted, that is acceptable. The
important change is that the new contract exists and the next action is more
concrete.

## Console And Markdown

Add a short `Bootstrap` section when bootstrap mode is used.

Console:

- attempted or not
- contract written path
- contract intent
- next commands

Markdown / PR-comment:

- `### Bootstrap`
- whether bootstrap ran
- whether contract was written
- contract path
- intent
- next commands

Keep this section concise and separate from `Recontract`.

## Error Handling And Safety

- `--bootstrap-contract` without `--intent` is an immediate error.
- Contract path validation must reuse the existing `.projscan/proof-contract.json`
  and `.projscan/proof-contracts/<name>.json` restrictions.
- Symlinked or invalid contract paths must still fail.
- Bootstrap must not execute proof commands.
- Bootstrap must not mutate task files, ledgers, or unrelated artifacts.
- Bootstrap must not guess intent from changed files.
- MCP must remain evidence-only for proof execution; if bootstrap is exposed to
  MCP later, it should still only write the contract explicitly requested by the
  caller and must not execute proof commands.

## Testing

Core tests:

- bootstrap requires `--intent`
- bootstrap writes `.projscan/proof-contract.json` by default
- bootstrap preserves explicit `--save-contract` path
- bootstrap result is attached to Proof Broker report
- bootstrap result is attached to Review Gate report
- post-bootstrap next commands pivot away from missing-contract advice
- invalid paths and symlinks still fail

CLI tests:

- `proof-broker --intent ... --bootstrap-contract --format json`
  writes a contract and returns bootstrap metadata
- `review-gate --intent ... --bootstrap-contract --format json`
  does the same
- console output shows `Bootstrap`
- Markdown / PR-comment output shows `Bootstrap`
- explicit error when bootstrap is requested without intent

Dogfood tests:

- in the linked proof worktree, run bootstrap mode from `proof-broker`
- rerun `review-gate` against the written contract
- confirm the loop moves from `missing-contract` to a contract-backed state,
  even if the diff still remains drifted

## Post-Bootstrap Bug Pass

Before cutting `5.x`, run one bounded bug pass focused on:

- write-path safety and symlink/path traversal protection
- stale built output in linked worktrees
- bootstrap output consistency across console, JSON, and Markdown
- proof/gate command alignment after bootstrap
- release-note and npm-status evidence consistency

The bug pass should be its own task slice if it surfaces code changes beyond
trivial fixes.

## Release Gate For 5.x

After bootstrap and bug pass are proven, open a dedicated release task that:

1. chooses the exact `5.x.x` version,
2. runs release-grade verification,
3. generates release notes,
4. checks npm status,
5. cuts the version only after fresh handoff and gate evidence.

This spec does not authorize the version bump itself.

## Acceptance Criteria

- `proof-broker` and `review-gate` can both explicitly write a scoped Proof
  Contract when bootstrap mode is requested with intent.
- The commands reuse existing Proof Contract generation and path validation
  logic rather than inventing a second writer.
- Output remains explicit, local, and advisory about proof execution.
- Post-bootstrap reports return a clearer next loop than the current
  missing-contract-only path.
- Focused tests and linked-worktree dogfood prove the new write-assisted loop.

## Stop Conditions

Stop and ask before implementation continues if:

- bootstrap cannot reuse the existing `prove` writer cleanly,
- the safest contract-write API needs a different public flag shape than this
  design assumes,
- exposing bootstrap on both surfaces creates incompatible report contracts,
- the bug pass reveals a broader release blocker outside proof-loop ownership.

## Release Constraint

This is a pre-release `5.x` design slice. Do not bump the package version, tag,
publish, deploy, push, or cut release artifacts during implementation of this
spec alone.
