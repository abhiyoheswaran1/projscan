# Executable Proof Contracts Design

## Goal

Add `projscan prove` as the closed loop above Proof Cards. Before editing, it
turns an intent into an executable Proof Contract. After editing, it validates
the working tree against that contract and emits a reviewer-ready Proof Receipt.

## Product Direction

The product bet is not another scanner or autofix. projscan should be the local
proof layer for AI-assisted software engineering:

1. identify the safe change slice;
2. show evidence and gaps;
3. constrain agents and engineers to allowed scope;
4. require exact proof commands;
5. validate the real diff;
6. create a receipt reviewers and CI can trust.

This builds on the existing `assess`, Proof Cards, `simulate`, Mission Control,
MCP, and Trust Memory surfaces. It must stay local-first and additive.

## Commands

### `projscan prove --intent "<change>"`

Creates a Proof Contract for proposed work. The command is read-only unless
`--save-contract <path>` is supplied.

The contract includes:

- allowed files from simulation candidates and Proof Card files;
- forbidden files inferred from the current repository, generated/cache paths,
  secret-bearing paths, release metadata, and high-risk public surfaces not
  named by the plan;
- risky contracts and APIs from simulator contract inference and file paths;
- likely tests from simulation;
- missing regression-test notes when likely tests are absent;
- exact proof commands;
- safe implementation shape;
- rollback plan;
- confidence, confidence reason, and evidence gaps;
- Trust Memory summary;
- reviewer guidance;
- a receipt command for after edits.

### `projscan prove --changed`

Validates the current working tree. It reads a contract from `--contract <path>`
or from `.projscan/proof-contract.json` when present. If no contract exists, it
still emits a receipt, but marks contract evidence as missing and limits the
verdict to review-needed.

The changed report includes:

- changed files from local git evidence;
- scope status for allowed and forbidden paths;
- missing or unrun proof commands;
- new risks from preflight and fix-first assessment;
- risk delta from the current assessment or contract baseline;
- commit readiness: `ready`, `needs-review`, or `blocked`;
- a compact Proof Receipt for PRs, agents, and CI.

## CLI Output

`prove` supports `console`, `json`, and `markdown`.

- JSON is the source of truth for agents and CI.
- Markdown is the reviewer receipt format.
- Console prints the verdict, scope status, top allowed/forbidden findings, and
  proof commands without long prose.

## MCP

Add `projscan_prove`.

Inputs:

- `intent`: proposed change intent.
- `changed`: boolean.
- `contract_path`: optional local contract path.
- `save_contract_path`: optional local output path for intent mode.
- `max_files`: optional cap for likely file scope.
- `feedback_path`: optional local feedback artifact.
- `max_tokens`: standard MCP budget hint.

Output:

- `{ prove: ProveReport }`.

MCP must not require parsing CLI text and must preserve the same JSON shape as
the CLI.

## Data Flow

Intent mode:

1. normalize intent;
2. run `computeSimulation(..., { plan: intent })`;
3. read optional feedback memory when `--feedback` is supplied;
4. compose Proof Contract fields from simulation and feedback evidence;
5. optionally write the contract JSON only when `--save-contract` is present;
6. render JSON, Markdown, or console.

Changed mode:

1. read optional contract;
2. collect changed files through existing local git changed-file utilities;
3. run `computePreflight(..., { mode: "before_commit" })`;
4. compare changed files with allowed and forbidden contract scope;
5. create Proof Receipt with readiness, drift, missing evidence, and commands.

## Error Handling

- Empty intent in intent mode exits with a clear error.
- `--intent` and `--changed` together is invalid.
- Missing contract path in changed mode is not fatal; the receipt says no
  contract was applied.
- Invalid contract JSON is fatal when the user supplied `--contract`.
- Failed optional contract discovery is non-fatal only for the default path.
- No secret values are read or printed.

## Trust Memory

`--feedback <path>` uses the existing feedback artifact path and passes it into
assessment. Contract outputs include the Trust Memory status from the top Proof
Card when available. If no feedback is present, the contract says so directly.

## Testing

Tests must cover:

- core intent contract generation;
- core changed receipt with scope drift and forbidden file detection;
- changed mode without a contract;
- CLI JSON, Markdown, console, and argument errors;
- optional save/read contract behavior;
- MCP registration and handler output;
- docs command format support.

## Documentation

Update README, guide/docs, DECISIONS, and website prompt. Position Proof
Contracts as the next pillar after Proof Cards V2, not a replacement for
`assess` or `simulate`.

## Release Constraint

This work must not release, tag, publish, deploy, push, merge, or bump versions.
Release approval is separate and must come from the user after implementation,
bug pass, docs pass, and performance pass.
