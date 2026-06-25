# Proof Sufficiency Engine Design

## Goal

Upgrade the existing proof-first workflow so `projscan prove` and `projscan evidence-pack --pr-comment` can answer whether the recorded proof is enough for the risk surface that changed.

## Product Shape

The work improves the current Proof Contract and Proof Receipt workflow without adding a command.

The daily path stays:

```bash
projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json
projscan prove --run -- npm test -- tests/billing/retry.test.ts
projscan prove --changed --contract .projscan/proof-contract.json --format markdown
projscan evidence-pack --pr-comment
```

The new behavior adds a Proof Requirements Matrix and a Proof Sufficiency summary. Reviewers can see each changed surface, which proof covers it, whether the proof is fresh, and which gap remains.

## User Problems

Engineers and reviewers already get contracts, changed-file classes, and proof replay. The missing answer is: "Is this proof enough for what changed?"

The current system can report `passed` proof while still leaving reviewer work:

- the command passed but did not map to the changed surface
- the command ran before the last edit
- a security/config/API surface changed without a focused proof command
- a likely test was identified but not touched
- evidence strength stayed medium because the contract came from limited local signals

The Proof Sufficiency Engine makes those cases explicit.

## Data Model

Additive fields only:

- `ProveContract.proofRequirements`
- `ProveReceipt.proofSufficiency`
- `ProveVerifiedWorkflow.proofSufficiencyStatus`
- `EvidencePackProofReceiptSummary.proofSufficiencyStatus`
- `EvidencePackProofReceiptSummary.weakRequirements`
- `EvidencePackProofReceiptSummary.missingRequirements`

`proofRequirements` rows:

- `id`
- `surface`: `production` | `test` | `documentation` | `config` | `security` | `public-api` | `cli` | `mcp` | `dependency` | `generated` | `unknown`
- `files`
- `requiredCommands`
- `requiredReview`
- `reason`

`proofSufficiency`:

- `status`: `strong` | `adequate` | `weak` | `missing` | `stale` | `failed`
- `summary`
- `requirements`: per-row status with matching command evidence
- `gaps`

## Rules

Sufficiency is judged per requirement.

- `failed`: any matching command has a fresh non-zero exit code.
- `stale`: matching commands exist but all are stale.
- `missing`: no matching command evidence exists and the requirement has required commands.
- `weak`: proof passed, but no changed file or test evidence connects the command to the requirement.
- `adequate`: at least one matching fresh command passed, or a docs/generated-only row needs no command and the scope has no risky drift.
- `strong`: a fresh matching command passed and the changed files include the expected test or focused surface.

Overall status uses the most severe requirement status:

`failed` > `stale` > `missing` > `weak` > `adequate` > `strong`

Receipt decisions use the existing verdict model. Sufficiency can move a receipt from `ready` to `needs-review`, but only failed proof or existing blocking signals move it to `blocked`.

## Risk Surfaces

The current changed-file classifier remains the source of truth. The new layer maps those classifications into proof surfaces:

- `allowed-production` -> `production`
- `expected-test` and `unexpected-test` -> `test`
- `documentation` -> `documentation`
- `config` -> `config`
- `security-sensitive` -> `security`
- `generated` -> `generated`
- file paths under `src/cli/` -> `cli`
- file paths under `src/mcp/` -> `mcp`
- type barrels or `src/types/` -> `public-api`
- package manifests and lockfiles -> `dependency`

The classifier stays intentionally simple. It should not add dependency scanning or coverage parsing in this slice.

## Rendering

`projscan prove --changed --format markdown` gains:

- `## Proof Sufficiency`
- overall status and summary
- per-requirement rows with surface, status, files, commands, and gaps

The console output shows:

- `Proof Sufficiency`
- status
- top gaps

`projscan evidence-pack --pr-comment` adds proof sufficiency lines under `### Proof Receipt`.

## Security

No new command execution path is added. `prove --run` keeps shell execution disabled and uses the existing redacted proof logs. The sufficiency engine only reads the already loaded contract, changed files, and ledger rows.

## Performance

The engine uses existing in-memory receipt inputs. It must not call `computeSimulation`, `computePreflight`, or git again. Matching commands and files is linear in the number of contract rows, changed files, and ledger command evidence.

## Documentation

README and guide updates should explain Proof Sufficiency in the existing Verified Change Workflow. The copy must stay grounded: projscan can judge local proof sufficiency against its contract and changed-file evidence; it cannot guarantee the code is correct.

## Acceptance

- Intent contracts include `proofRequirements`.
- Changed receipts include `proofSufficiency`.
- Markdown receipts and evidence-pack PR comments show sufficiency.
- Tests cover passed, weak/missing, stale, failed, and PR-comment rendering paths.
- Docs mention Proof Sufficiency without changing release version metadata.
