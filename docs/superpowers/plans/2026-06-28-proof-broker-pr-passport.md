# Proof Broker and PR Passport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare ProjScan 4.18.0 with Proof Broker and PR Passport so reviewers can see required proof, proof gaps, required reviewers, risky changed files, and next commands from one local command and MCP tool. Do not tag, publish, or trigger a release from this plan.

**Architecture:** Build `computeProofBroker()` on top of `computePassport()` so the broker reuses the existing Proof Contract, Proof Receipt, Proof Replay, Proof Sufficiency, Team Proof Recipes, and reviewer action logic. Add a thin CLI/MCP layer that never runs proof commands and a Markdown renderer for PR comments.

**Tech Stack:** TypeScript, Commander CLI, existing MCP tool catalog, Vitest, existing ProjScan proof ledger and config APIs.

---

### Task 1: Core Proof Broker

**Files:**
- Create: `src/types/proofBroker.ts`
- Create: `src/core/proofBroker.ts`
- Test: `tests/core/proofBroker.test.ts`

- [ ] **Step 1: Write failing core tests**

Add tests that create a synthetic billing fixture, save a Proof Contract with a billing recipe, change billing files, and assert that `computeProofBroker()` returns:
- `kind: "proof-broker"`
- reviewer action from the passport
- required proof rows from `receipt.proofSufficiency.requirements`
- required reviewers from Team Proof Recipes
- missing/stale/failed proof gaps
- risky changed files and next commands
- PR Passport Markdown with required sections

Run: `npm run test -- tests/core/proofBroker.test.ts`
Expected: fail because `src/core/proofBroker.ts` does not exist.

- [ ] **Step 2: Implement core types and broker**

Create additive public types:
- `ComputeProofBrokerOptions`
- `ProofBrokerReport`
- `ProofBrokerRequiredProof`
- `ProofBrokerGap`
- `ProofBrokerPrPassport`

Implement:
- `computeProofBroker(rootPath, options)`
- `renderPrPassportMarkdown(report)`
- validation that all data comes from `computePassport()`
- no command execution

- [ ] **Step 3: Run core tests**

Run: `npm run test -- tests/core/proofBroker.test.ts`
Expected: pass.

### Task 2: CLI Command

**Files:**
- Create: `src/cli/commands/proofBroker.ts`
- Modify: `src/cli/registerCommands.ts`
- Modify: `src/utils/formatSupport.ts`
- Test: `tests/cli/proofBroker.test.ts`
- Modify: `tests/cli/registerCommands.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Assert `projscan proof-broker` supports:
- `--intent`
- `--contract`
- `--save-contract`
- `--output-passport`
- `--pr-comment`
- `--base-ref`
- `--ledger`
- `--format json`
- default console output

Run: `npm run test -- tests/cli/proofBroker.test.ts tests/cli/registerCommands.test.ts`
Expected: fail because the command is not registered.

- [ ] **Step 2: Implement CLI**

Register `proof-broker` after `passport` and before `guard`. Use existing format support and config loading. Print PR Passport Markdown when `--pr-comment` is set. Keep error handling aligned with `passport`.

- [ ] **Step 3: Run CLI tests**

Run: `npm run test -- tests/cli/proofBroker.test.ts tests/cli/registerCommands.test.ts`
Expected: pass.

### Task 3: MCP Tool and Public API

**Files:**
- Create: `src/mcp/tools/proofBroker.ts`
- Modify: `src/mcp/toolCatalog.ts`
- Modify: `src/publicCore.ts`
- Modify: `src/types.ts`
- Test: `tests/mcp/proofBroker.test.ts`
- Test: `tests/types/public-proof-broker-types.test.ts`

- [ ] **Step 1: Write failing MCP and type tests**

Assert MCP lists `projscan_proof_broker`, returns broker evidence, and does not expose run-proof inputs. Assert public barrel exports `computeProofBroker` and broker types.

Run: `npm run test -- tests/mcp/proofBroker.test.ts tests/types/public-proof-broker-types.test.ts`
Expected: fail because exports do not exist.

- [ ] **Step 2: Implement MCP and exports**

Add an MCP handler with input parity to CLI options. Return JSON evidence only.

- [ ] **Step 3: Run MCP and type tests**

Run: `npm run test -- tests/mcp/proofBroker.test.ts tests/types/public-proof-broker-types.test.ts`
Expected: pass.

### Task 4: Docs, Version, Release Metadata

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`
- Modify: `docs/STABILITY.md`
- Modify: `CHANGELOG.md`
- Modify: `DECISIONS.md`
- Modify: `.github/mcp-registry/server.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: tests under `tests/docs/`

- [ ] **Step 1: Update docs and version metadata**

Set package version to `4.18.0`. Update tool count to 50. Add public docs for Proof Broker and PR Passport. Update release prompt and changelog.

- [ ] **Step 2: Run Stop Slop checks on added public prose**

Scan changed docs for banned phrasing and rewrite public copy until the added lines pass.

- [ ] **Step 3: Run docs tests**

Run: `npm run test -- tests/docs/proveDocs.test.ts tests/docs/publicCounts.test.ts`
Expected: pass.

### Task 5: Pre-Release Verification and Handoff

**Files:**
- No source changes after verification except generated release artifacts if required by existing scripts.

- [ ] **Step 1: Run focused verification**

Run the task-specific Vitest command, `npm run typecheck`, `npm run lint`, and `npm run build`.

- [ ] **Step 2: Run bug pass**

Run focused proof-broker tests multiple times, inspect CLI smoke output in a synthetic repo, run `git diff --check`, and review changed files.

- [ ] **Step 3: Run release-grade local verification**

Run full `npm run test`, stability, security release gate, public typecheck, packed install smoke, AgentLoop verify, gates, ship, and release notes.

- [ ] **Step 4: Commit and prepare handoff**

Commit the verified pre-release work if appropriate. Do not push a release tag, publish npm, create a GitHub release, or trigger a release workflow.
