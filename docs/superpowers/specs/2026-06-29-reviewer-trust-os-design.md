# Reviewer Trust OS Five-Loop Design

## Goal

Make ProjScan's next release feel like the local trust layer for AI-authored code review, not a collection of analysis commands. The product should let a reviewer or agent ask one question:

```bash
npx projscan review-gate --intent "is my agent allowed to change billing retry logic?"
```

The answer should be one local handoff with the current review decision, proof debt, drift/recontract guidance, required reviewers, CI behavior, and the next command that closes the evidence gap. It must build on Proof Broker and PR Passport rather than reimplementing Proof Contract, Proof Receipt, Proof Replay, Proof Sufficiency, or Team Proof Recipe logic.

## Product Bet

The industry-leading wedge is reviewer trust. Agent coding speed is no longer rare; the pain is deciding whether an AI-authored change can be reviewed safely. ProjScan should make that decision concrete:

- **Ready:** scope is within the contract and proof is adequate for human review.
- **Needs proof:** the change may be reviewable, but proof debt remains.
- **Blocked:** the change failed proof or lacks a contract.
- **Drifted:** the change left the approved boundary and needs a new contract before review.

The command must never imply autonomous approval. It prepares evidence for reviewers and CI gates; humans still approve or reject the PR.

## Five Implementation Loops

1. **Review Gate Core**
   Add `computeReviewGate()` plus `projscan review-gate`. The report wraps `computeProofBroker()` and returns a stable decision object with status, reviewer action, reviewer decision, proof debt, recontract guidance, required reviewers, next commands, artifacts, and the embedded Proof Broker report.

2. **Proof Debt**
   Add a first-class `proofDebt` section that counts missing, failed, stale, weak, recipe, and scope debt. Each item must name the requirement, command or file, severity, owner/reviewer when known, and the exact next action. This turns "proof is weak" into an actionable checklist.

3. **Auto Recontract Guidance**
   Add a `recontract` section that explains whether the agent should stop and create a new contract. It must list drift files, why widening the current contract is not automatic, and the command for a new contract. When no recontract is needed, the section should say so explicitly.

4. **CI and PR Comment Mode**
   Add PR Markdown and CI flags:
   - `--pr-comment` prints the reviewer-facing Markdown only.
   - `--ci` prints a compact gate summary suitable for logs.
   - `--fail-on-block` exits non-zero for `blocked` or `drifted`.
   - `--fail-on-needs-proof` exits non-zero for `needs-proof`, `blocked`, or `drifted`.
   Default command execution should not fail because the report says more proof is needed; users must opt into CI failure behavior.

5. **Docs, Public API, and Bug Pass**
   Export types, expose MCP parity, update stability/docs/website prompt, run stop-slop on public docs, add tests, and run release-grade local verification. Do not release, tag, publish, push, or trigger release automation.

## Public Surface

### CLI

Add:

```bash
projscan review-gate
```

Supported flags:

- `--intent <text>`: create or refresh a Proof Contract before evaluating the working tree.
- `--contract <path>`: read an existing Proof Contract.
- `--save-contract <path>`: write the generated Proof Contract when intent is supplied.
- `--output-passport <path>`: pass through to Proof Broker for `.projscan/passport.json`.
- `--output <path>`: write Review Gate JSON to `.projscan/review-gate.json` or `.projscan/review-gates/<name>.json`.
- `--max-files <count>`, `--feedback <path>`, `--base-ref <ref>`, `--ledger <path>`: parity with Proof Broker.
- `--pr-comment`: print Markdown.
- `--ci`: print a compact CI summary.
- `--fail-on-block`: fail the process for blocked or drifted gates.
- `--fail-on-needs-proof`: fail the process for needs-proof, blocked, or drifted gates.
- `--format console|json|markdown`: supported by the existing format system.

### MCP

Add `projscan_review_gate`, bringing the MCP tool count to 51 in this pre-release tree. The MCP tool returns structured Review Gate evidence and must not execute proof commands. It should expose the same read/write evidence options as the CLI, but it must not expose proof command execution.

### TypeScript API

Add:

```ts
computeReviewGate(rootPath, options)
```

Export:

- `ComputeReviewGateOptions`
- `ReviewGateReport`
- `ReviewGateStatus`
- `ReviewGateDecision`
- `ReviewGateProofDebt`
- `ReviewGateProofDebtItem`
- `ReviewGateRecontractGuidance`
- `ReviewGatePrComment`

## Data Model

`ReviewGateReport` should use schema version 1 and include:

- `schemaVersion: 1`
- `kind: "review-gate"`
- `generatedAt`
- `status: "ready" | "needs-proof" | "blocked" | "drifted"`
- `decision`: human-readable gate decision and machine-readable `allowReview: boolean`
- `reviewer`: reviewer action, reviewer decision, and summary from the broker/passport
- `proofDebt`: totals plus itemized proof debt
- `recontract`: stop/recontract guidance
- `requiredReviewers`
- `nextCommands`
- `artifacts`
- `prComment`
- `proofBroker`

`allowReview` means "review can proceed with the current evidence." It does not mean "merge" or "approve."

## Architecture

Add `src/core/reviewGate.ts` as a small projection layer:

1. Call `computeProofBroker(rootPath, options)`.
2. Convert Proof Broker gaps and required proof rows into proof debt items.
3. Derive review-gate status from the embedded passport status and blocker debt.
4. Build recontract guidance from scope drift, missing contract, and reviewer action.
5. Build next commands from Proof Broker commands plus the review-gate command.
6. Optionally write `.projscan/review-gate.json` through the same safe path rules used by passport artifacts.

The module should not import CLI code and should not execute commands. Rendering helpers can live in the core module if they are reused by CLI and MCP tests, matching the Proof Broker pattern.

## Data Flow

```text
intent or contract
  -> computeReviewGate()
  -> computeProofBroker()
  -> computePassport()
  -> computeProve(changed)
  -> ReviewGateReport
  -> console, JSON, Markdown, MCP, or local JSON artifact
```

All proof command strings are evidence and next actions only. Running proof remains in `projscan prove --run`.

## Error Handling and Safety

- Missing or invalid contracts should return a blocked report when `computeProofBroker()` can produce one; unrecoverable file/JSON errors should throw.
- Output paths must stay inside the repo and be restricted to `.projscan/review-gate.json` or `.projscan/review-gates/<name>.json`.
- Existing unrelated output files must not be overwritten.
- Symlink output paths must be rejected.
- Shell commands in Markdown must use existing Markdown and shell-quoting helpers.
- No secrets should be read or printed.
- No telemetry, network calls, hosted scan behavior, or hidden command execution should be added.

## Documentation

Update public docs around the new lead story:

- README: show the five-command review loop with `review-gate` after `proof-broker`, and make Review Gate the "one decision" surface.
- Guide: add a `review-gate` command reference section and include it in the agent-native tool map.
- Stability docs: add the command, flags, JSON stability note, and MCP tool.
- Website prompt: change the 4.18.0 release story from "Proof Broker and PR Passport" to the broader Reviewer Trust OS story, while keeping Proof Broker as the underlying handoff layer.
- Changelog and DECISIONS: record the new public behavior.

The package version should not change during this no-release loop unless a later release task explicitly decides to bump it.

## Testing

Use focused TDD per loop, then run release-grade verification.

Core tests:

- ready gate with adequate proof allows review.
- needs-proof gate itemizes missing and weak proof.
- failed proof blocks or fails CI when requested.
- drifted scope emits recontract guidance and blocks review.
- output artifact path restrictions reject traversal, symlink, and unrelated overwrite cases.

CLI tests:

- JSON report includes decision, proof debt, recontract, PR comment, embedded broker.
- `--pr-comment` prints Markdown with status, debt, recontract, reviewers, next commands.
- `--ci --fail-on-block` and `--ci --fail-on-needs-proof` set expected exit codes.

MCP tests:

- `projscan_review_gate` appears in tool list.
- schema has no proof execution inputs.
- handler returns review-gate evidence and PR Markdown.

Docs/type tests:

- public barrel exports compile.
- README/GUIDE/STABILITY/website prompt mention Review Gate and 51 MCP tools.
- command registration order includes `registerReviewGate`.
- MCP public count tests align with registry metadata.

## Stop Conditions

Stop and ask before implementation continues if:

- the design requires a dependency addition,
- an output shape would break existing public API contracts,
- a feature would run proof commands through MCP,
- CI failure semantics conflict with existing command behavior,
- the existing Proof Broker report lacks required evidence and would need a larger redesign.

## Release Constraint

This work prepares the next release but does not perform it. Do not run release, publish, tag, GitHub release, push, or deployment commands as part of this task.
