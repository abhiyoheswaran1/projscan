# Proof Replay Design

## Goal

Make the existing proof-first workflow verifiable and replayable. `projscan
prove`, Mission Control, and `evidence-pack` should show whether required proof
commands ran, whether the evidence still matches the current changed files, and
what a reviewer can trust.

## Product Position

projscan already recommends safe scope, proof commands, risk deltas, and review
gates. Proof Replay closes the loop:

1. record proof command outcomes locally;
2. compare those outcomes with the current proof contract and changed files;
3. mark proof as passed, failed, missing, stale, or partial;
4. include the result in the reviewer receipt and PR evidence pack.

This improves the existing proof-first surfaces. It does not add autofix,
remote storage, telemetry, or a new top-level command.

## Local Proof Ledger

Add `src/core/proofLedger.ts` and `src/types/proofLedger.ts`.

Default path: `.projscan/proof-ledger.jsonl`.

Each row records:

- `schemaVersion: 1`;
- `id`;
- `command`;
- `cwd`;
- `exitCode`;
- `status`: `passed` or `failed`;
- `startedAt` and `completedAt`;
- `durationMs`;
- `changedFileFingerprint`;
- `changedFiles`;
- `outputSummary`;
- optional `logPath`;
- optional `source`: `prove-record`, `mission`, or `external`.

The ledger stores summaries, not raw command output. Summary text is capped and
redacted for common token, key, password, bearer, webhook, and `.env` patterns.
Log paths must be relative paths under the repo or mission directory; projscan
does not read log contents when building receipts.

## Recording Evidence

Add an additive mode to the existing `projscan prove` command:

```bash
projscan prove --record-command "npm test -- tests/core/prove.test.ts" \
  --exit-code 0 \
  --duration-ms 4210 \
  --summary "13 tests passed" \
  --log .projscan/proof-logs/prove-test.log
```

This mode records an explicit outcome. It does not execute shell commands. That
keeps command execution out of projscan and lets agents, CI, or Mission Control
record proof after running commands through their existing runner.

Mission Control bundles already execute proof commands through `mission.sh`.
Update the generated script so each command row also appends to the repo-level
ledger when it can find the repository root. If the ledger write fails, the
mission proof still completes; the run report notes the local ledger write
failure.

## Changed-File Fingerprint

The fingerprint is deterministic and local:

```text
sha256(sorted changed file paths joined with "\n")
```

It does not hash file contents and does not read `.env` values. A proof row is
fresh when its fingerprint matches the current changed-file set. It is stale
when the command matched but the fingerprint differs.

## Prove Receipt

`projscan prove --changed` reads the contract, current changed files, preflight,
and the ledger. It compares required proof commands with ledger rows by
normalized command string.

Add to `ProveReceipt`:

- `proofStatus.status`: `passed`, `failed`, `missing`, `stale`, or `partial`;
- command-level entries with command, status, exit code, duration, completed
  time, stale flag, stale reason, and log path;
- `riskDeltaDirection`: `improved`, `worse`, or `flat`;
- `reviewerDecision`: `safe-to-review`, `needs-focused-review`, or `stop`.

Decision rules:

- `stop`: forbidden scope, preflight block, or any required proof command
  failed.
- `needs-focused-review`: missing/stale/partial proof, scope drift, config or
  security-sensitive drift, or preflight caution.
- `safe-to-review`: scope is within contract, required proof passed and fresh,
  and preflight proceeds.

Existing verdict fields remain intact. New fields are additive.

## Trust Memory Outcomes

Add optional proof-outcome signals to feedback responses:

- `proofOutcome`: `accepted`, `rejected`, `reverted`, `suppressed`, or `noisy`;
- `proofContractId`;
- `proofReceiptStatus`;
- `proofReviewerDecision`.

`prove --intent --feedback` and `assess --feedback` can use these signals as
Trust Memory. Accepted outcomes can raise confidence. Rejected, reverted, or
noisy outcomes lower confidence and add an evidence gap.

## Evidence Pack Integration

`computeEvidencePack` should attempt to read a current Proof Receipt from the
default contract and ledger. If available, add `proofReceipt` to
`EvidencePackReport` and add a `### Proof Receipt` section to
`evidence-pack --pr-comment`.

The section should include:

- reviewer decision;
- scope status;
- proof status;
- stale or missing commands;
- first log path for failed proof;
- copyable command: `projscan prove --changed --format markdown`.

If no contract or ledger exists, the section should say no Proof Receipt was
applied and point to the command. It should not fail evidence-pack.

## Docs And Media

README and guide should show the normal flow:

```bash
projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json
npm test -- tests/core/billingRetry.test.ts
projscan prove --record-command "npm test -- tests/core/billingRetry.test.ts" --exit-code 0 --duration-ms 4210 --summary "tests passed"
projscan prove --changed --contract .projscan/proof-contract.json --format markdown
projscan evidence-pack --pr-comment
```

Add or refresh a README screenshot/GIF showing the Proof Receipt with proof
status and reviewer decision. Use existing repo media scripts where possible.

## Non-Goals

- No shell execution engine inside `prove`.
- No cloud proof storage.
- No secret scanning of command logs.
- No release, tag, publish, deploy, push, merge, or version bump.

## Verification

Run focused tests, typecheck, lint, build, doctor, bug-hunt, stability checks,
security review, performance smoke, docs/media generation, AgentLoop verify,
gates, and ship scoring before asking for release approval.
