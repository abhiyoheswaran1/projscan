# Verified Change Workflow Design

## Goal

Make the existing proof-first workflow easier to use as one path:

1. `projscan start --intent "<change>"` routes agent-allowed and safe-change prompts to `projscan prove`.
2. `projscan prove --intent "<change>"` creates a local Proof Contract.
3. `projscan prove --record-command "<command>"` records proof evidence in the local ledger.
4. `projscan prove --changed` emits a reviewer receipt that names scope, proof replay, risk delta, and the next action.

This is an improvement to existing `start`, `prove`, MCP, and docs behavior. It does not add a new command, run shell commands, upload source, publish a release, or change the package version.

## Current Gap

`prove` already creates contracts and receipts, but `start` cannot route directly to `projscan_prove` because the intent router catalog does not list that tool. Users must know the command name and stitch together the contract, proof ledger, receipt, and PR comment themselves.

The receipt also contains the right raw fields but lacks a compact workflow summary that agents and MCP clients can read without parsing Markdown sections.

## Design

Add `projscan_prove` to the route catalog with narrow keywords for proof contracts, agent permission, allowed files, forbidden files, scope, proof receipts, stale proof, and proof replay. Keep generic "is this safe to commit?" prompts on `projscan_preflight`.

Add route argument and command builders for `projscan_prove`:

- `projscan prove --intent "<intent>" --save-contract .projscan/proof-contract.json --format json` for before-edit/agent-permission prompts.
- MCP args: `{ intent, save_contract_path: ".projscan/proof-contract.json" }`.

Add an additive `verifiedWorkflow` field to `ProveContract`, `ProveReceipt`, and `ProveReport`. The field gives agents and reviewers a compact summary:

- `phase`: `contract`, `receipt`, or `record`
- `status`: `ready`, `needs-review`, or `blocked`
- `nextAction`
- `nextCommand`
- `reviewerDecision`
- `scopeStatus`
- `proofStatus`
- `riskDeltaDirection`
- `staleProof`
- `missingProof`
- `failedProof`

Keep all existing fields and Markdown sections.

Update the MCP tool description and tests so agents can rely on `verifiedWorkflow` instead of scraping receipt prose.

## Security And Privacy

The design does not execute user-supplied commands. `prove --record-command` keeps its current behavior: it records a caller-supplied result and redacts summaries through the proof ledger layer. Custom paths stay under the repo root through existing path checks.

No telemetry, network calls, or hidden writes are added. Intent mode only writes when `--save-contract` is passed.

## Documentation

Update README and `docs/GUIDE.md` to show a daily verified change flow:

```bash
projscan start --intent "is my agent allowed to change billing retry logic?"
projscan prove --intent "is my agent allowed to change billing retry logic?" --save-contract .projscan/proof-contract.json
projscan prove --record-command "npm test -- tests/billing/retry.test.ts" --exit-code 0 --duration-ms 1842 --summary "billing retry tests passed"
projscan prove --changed --contract .projscan/proof-contract.json --format markdown
```

Docs should say exactly what the workflow proves and what it does not do.

## Verification

Run focused tests first:

```bash
npm test -- tests/core/prove.test.ts tests/cli/prove.test.ts tests/mcp/prove.test.ts tests/core/intentRouter.test.ts tests/cli/startIntentRouting.test.ts tests/docs/proveDocs.test.ts
```

Run release-grade local checks before handoff:

```bash
npm run typecheck
npm run lint
npm run build
npm run security:release-gate
npm run check:stability
```
