# Risk Delta Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `projscan simulate` so engineers can evaluate proposed change plans with local evidence before editing.

**Architecture:** Add a focused simulator core that composes repository scan, code graph, quality scorecard, and existing risk-delta scoring. Expose it through CLI, MCP, public types, and docs. Keep it read-only and deterministic.

**Tech Stack:** TypeScript, Node.js ESM, Commander CLI, MCP tool registry, Vitest, existing projscan graph/quality/risk-delta modules.

---

### Task 1: Core Simulator Types And Behavior

**Files:**
- Create: `src/types/simulate.ts`
- Create: `src/core/simulate.ts`
- Test: `tests/core/simulate.test.ts`
- Modify: `src/types.ts`
- Modify: `src/publicCore.ts`

- [ ] **Step 1: Write failing core tests**

Create `tests/core/simulate.test.ts` with tests that call `computeSimulation(tmp, { plan })` on a small fixture containing `src/core/bugHunt.ts`, `src/core/bugHuntRanking.ts`, and related tests. Assert that the report returns schema version 1, likely touched files, likely tests, rollout steps, proof commands, and a positive risk delta for a split/extract plan.

- [ ] **Step 2: Run the core tests and confirm RED**

Run:

```bash
./node_modules/.bin/vitest run --exclude '.worktrees/**' tests/core/simulate.test.ts --reporter=dot
```

Expected: fail because `src/core/simulate.ts` and `src/types/simulate.ts` do not exist.

- [ ] **Step 3: Implement public types and core**

Implement `SimulateReport`, `SimulateCandidateFile`, `SimulateEvidence`, `SimulateRolloutStep`, and `computeSimulation`. The implementation should normalize the plan, rank candidates from file path and basename token matches, use graph fan-in/fan-out/importers when available, include quality-scorecard risk evidence, calculate risk delta, and produce deterministic proof commands.

- [ ] **Step 4: Run the core tests and confirm GREEN**

Run:

```bash
./node_modules/.bin/vitest run --exclude '.worktrees/**' tests/core/simulate.test.ts --reporter=dot
```

Expected: pass.

### Task 2: CLI Command

**Files:**
- Create: `src/cli/commands/simulate.ts`
- Modify: `src/cli/registerCommands.ts`
- Modify: `src/utils/formatSupport.ts`
- Test: `tests/cli/simulate.test.ts`
- Test: `tests/cli/registerCommands.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Add tests for JSON output, markdown output, unsupported format rejection, and missing `--plan` failure.

- [ ] **Step 2: Run CLI tests and confirm RED**

Run:

```bash
npm run build
./node_modules/.bin/vitest run --exclude '.worktrees/**' tests/cli/simulate.test.ts tests/cli/registerCommands.test.ts --reporter=dot
```

Expected: fail because the command is not registered.

- [ ] **Step 3: Implement CLI**

Register `simulate`, support `--plan <text>` and `--max-files <count>`, support console/json/markdown formats, and render a concise console summary with proof commands.

- [ ] **Step 4: Run CLI tests and confirm GREEN**

Run the same command as Step 2.

### Task 3: MCP Tool

**Files:**
- Create: `src/mcp/tools/simulate.ts`
- Modify: `src/mcp/toolCatalog.ts`
- Test: `tests/mcp/simulate.test.ts`
- Test: `tests/mcp/registryDescriptor.test.ts`

- [ ] **Step 1: Write failing MCP tests**

Assert `projscan_simulate` appears in tool definitions and returns `{ simulate }` with the normalized plan, candidate files, risk delta, and proof commands.

- [ ] **Step 2: Run MCP tests and confirm RED**

Run:

```bash
./node_modules/.bin/vitest run --exclude '.worktrees/**' tests/mcp/simulate.test.ts tests/mcp/registryDescriptor.test.ts --reporter=dot
```

Expected: fail because the tool is not registered and registry count is stale.

- [ ] **Step 3: Implement MCP registration**

Add `simulateTool`, register it after `assessTool`, and update registry/tool-count docs from 46 to 47.

- [ ] **Step 4: Run MCP tests and confirm GREEN**

Run the same command as Step 2.

### Task 4: Assess Integration And Docs

**Files:**
- Modify: `src/core/proofCards.ts`
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/STABILITY.md`
- Modify: `.github/mcp-registry/server.json`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`
- Test: `tests/core/proofCards.test.ts`
- Test: `tests/docs/simulateDocs.test.ts`
- Test: `tests/docs/publicCounts.test.ts`

- [ ] **Step 1: Write failing integration/docs tests**

Assert hotspot Proof Cards include a simulate command, docs mention `projscan simulate --plan`, stable tool docs include `projscan_simulate`, and public count tests expect 47 tools.

- [ ] **Step 2: Run tests and confirm RED**

Run:

```bash
./node_modules/.bin/vitest run --exclude '.worktrees/**' tests/core/proofCards.test.ts tests/docs/simulateDocs.test.ts tests/docs/publicCounts.test.ts --reporter=dot
```

Expected: fail until docs and proof-card command hints are updated.

- [ ] **Step 3: Implement docs and proof-card hint**

Add the simulate hint to refactor-style Proof Cards and update README/GUIDE/STABILITY/registry/website prompt to describe the new workflow without claiming automatic fixes.

- [ ] **Step 4: Run tests and confirm GREEN**

Run the same command as Step 2.

### Task 5: Verification And Handoff

**Files:**
- No new production files unless verification reveals a bug.

- [ ] **Step 1: Run task verification**

Run:

```bash
npm exec agentloop -- verify --task .agentloop/tasks/2026-06-21-risk-delta-simulator.md --task-commands --only-task-commands --write-run
```

Expected: pass.

- [ ] **Step 2: Run gates and ship readiness**

Run:

```bash
npm exec agentloop -- handoff --task .agentloop/tasks/2026-06-21-risk-delta-simulator.md --write-run
npm exec agentloop -- check-gates
npm exec agentloop -- ship
```

Expected: gates pass, ship has no blockers. Do not release.
