# Team Proof Recipes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional config-driven proof recipes to the existing Proof Contract, Proof Sufficiency, Proof Replay, and evidence-pack workflow.

**Architecture:** Normalize `proofRecipes` through the existing config pipeline, pass config into `computeProve`, and keep recipe effects additive on contracts and receipts. Reuse current proof command evidence and readiness logic instead of adding a new command.

**Tech Stack:** TypeScript, Vitest, existing projscan config/prove/evidence-pack modules.

---

### Task 1: Config Normalization

**Files:**
- Modify: `src/types/config.ts`
- Create: `src/utils/configProofRecipes.ts`
- Modify: `src/utils/config.ts`
- Test: `tests/utils/config.test.ts`

- [ ] Write a failing config test that loads `.projscanrc.json` with one valid recipe and one invalid recipe.
- [ ] Run `npm test -- tests/utils/config.test.ts` and confirm it fails because `proofRecipes` is not normalized.
- [ ] Add `ProofRecipeConfig` to `src/types/config.ts` and `applyProofRecipes()` in `src/utils/configProofRecipes.ts`.
- [ ] Wire `applyProofRecipes()` into `src/utils/config.ts`.
- [ ] Run `npm test -- tests/utils/config.test.ts` and confirm it passes.

### Task 2: Contract And Receipt Integration

**Files:**
- Modify: `src/types/prove.ts`
- Modify: `src/core/prove.ts`
- Modify: `src/core/proofSufficiency.ts`
- Test: `tests/core/prove.test.ts`

- [ ] Write failing prove tests that pass `config.proofRecipes` into `computeProve`.
- [ ] Assert intent contracts include recipe commands, forbidden files, required reviewers, matched recipe IDs, and recipe proof requirements.
- [ ] Assert changed receipts include matched recipes and report missing recipe proof.
- [ ] Run `npm test -- tests/core/prove.test.ts` and confirm recipe assertions fail.
- [ ] Implement recipe matching with exact path and `/**` directory globs.
- [ ] Add additive `teamProofRecipes` contract and receipt fields.
- [ ] Include recipe commands in `proofCommands` and Proof Sufficiency requirements.
- [ ] Run `npm test -- tests/core/prove.test.ts` and confirm it passes.

### Task 3: CLI, MCP, And Evidence-Pack Output

**Files:**
- Modify: `src/cli/commands/prove.ts`
- Modify: `src/mcp/tools/prove.ts`
- Modify: `src/core/releaseEvidence.ts`
- Modify: `src/core/evidenceComment.ts`
- Modify: `src/types/evidencePack.ts`
- Test: `tests/cli/prove.test.ts`
- Test: `tests/core/releaseEvidence.test.ts`

- [ ] Write failing tests for CLI config loading and PR-comment recipe rendering.
- [ ] Run focused tests and confirm recipe output is missing.
- [ ] Load project config in CLI/MCP prove paths and pass it to `computeProve`.
- [ ] Render matched recipes and required reviewers in prove markdown and PR comments.
- [ ] Run focused tests and confirm they pass.

### Task 4: Docs And Stability

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/STABILITY.md`
- Modify: `DECISIONS.md`
- Test: `tests/docs/proveDocs.test.ts`

- [ ] Add doc expectations for `proofRecipes`, `teamProofRecipes`, and required reviewers.
- [ ] Update user-facing docs with concise config examples and no release automation claims.
- [ ] Record the additive public behavior in `docs/STABILITY.md` and `DECISIONS.md`.
- [ ] Run `npm test -- tests/docs/proveDocs.test.ts`.

### Task 5: Verification And Audit Swarm

**Files:**
- No planned production files.

- [ ] Run task verification commands from `.agentloop/tasks/2026-06-24-team-proof-recipes.md`.
- [ ] Launch independent agents for security, performance, tests/edge cases, docs/API, and config/compatibility audit.
- [ ] Integrate any concrete fixes from audit results.
- [ ] Rerun focused tests, build, lint, stability, security gate, performance smoke, AgentLoop verify, gates, and handoff.
