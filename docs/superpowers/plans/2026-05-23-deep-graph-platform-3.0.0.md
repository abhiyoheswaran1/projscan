# Deep Graph Platform 3.0.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship projscan 3.0.0 as a deeper code-intelligence platform with a stable semantic graph contract, stronger dataflow risk detection, and first-class CLI/MCP/API/docs surfaces.

**Architecture:** Build on the existing `CodeGraph` adapters instead of replacing them. Add a normalized semantic graph projection for agents, add a dataflow layer that wraps existing taint reachability and catches bridge functions that source and sink untrusted data, then wire both through review, MCP, CLI, public exports, and docs.

**Tech Stack:** TypeScript, Vitest, existing projscan CLI/MCP tool registration, existing AST adapters and review pipeline.

---

## File Structure

- Create `src/core/semanticGraph.ts`: stable semantic graph schema, node/edge builders, metrics, truncation metadata.
- Create `src/core/dataflow.ts`: direct/propagated taint risk projection plus bridge-function dataflow detection.
- Modify `src/core/review.ts`: include new dataflow risks in review verdicts while keeping `newTaintFlows` compatible.
- Modify `src/types.ts`: public interfaces for semantic graph, dataflow, and review dataflow risks.
- Create `src/mcp/tools/semanticGraph.ts` and `src/mcp/tools/dataflow.ts`: MCP tools with strict JSON outputs.
- Modify `src/mcp/tools.ts`: register the two new tools.
- Modify CLI command registration under `src/cli`: expose `semantic-graph` and `dataflow`.
- Modify `src/index.ts`: export the new core APIs.
- Add tests in `tests/core`, `tests/mcp`, and `tests/cli`.
- Update `README.md`, `docs/GUIDE.md`, `docs/STABILITY.md`, `docs/ROADMAP.md`, `docs/WEBSITE-UPDATE-PROMPT.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`, `.github/mcp-registry/server.json`, and `tool-manifest.json`.

## Task 1: Semantic Graph Contract

**Files:**

- Create: `src/core/semanticGraph.ts`
- Modify: `src/types.ts`
- Modify: `src/index.ts`
- Test: `tests/core/semanticGraph.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/core/semanticGraph.test.ts` with tests that build a fixture graph and assert:

```ts
expect(report.schemaVersion).toBe(3);
expect(report.nodes.some((node) => node.id === 'file:src/app.ts')).toBe(true);
expect(report.nodes.some((node) => node.kind === 'function' && node.label === 'handler')).toBe(
  true,
);
expect(
  report.edges.some((edge) => edge.kind === 'defines' && edge.from === 'file:src/app.ts'),
).toBe(true);
expect(report.edges.some((edge) => edge.kind === 'calls' && edge.label === 'run')).toBe(true);
expect(report.metrics.totalFiles).toBe(3);
expect(report.metrics.totalFunctions).toBeGreaterThanOrEqual(3);
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/core/semanticGraph.test.ts`
Expected: fail because `src/core/semanticGraph.ts` does not exist.

- [ ] **Step 3: Implement the minimal semantic graph builder**

Export `buildSemanticGraph(graph, options?)` and types. Use stable node IDs:

```ts
file:${relativePath}
function:${relativePath}#${functionName}@${line}
package:${packageName}
symbol:${symbolName}
```

Emit `defines`, `imports`, `imports_package`, and `calls` edges, plus `metrics` and `truncated` metadata.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- tests/core/semanticGraph.test.ts`
Expected: pass.

## Task 2: Dataflow Risk Engine

**Files:**

- Create: `src/core/dataflow.ts`
- Modify: `src/types.ts`
- Modify: `src/index.ts`
- Test: `tests/core/dataflow.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:

```ts
const report = computeDataflow(graph);
expect(report.available).toBe(true);
expect(
  report.risks.some(
    (risk) =>
      risk.kind === 'bridge' &&
      risk.bridgeFn === 'bridge' &&
      risk.sourceFn === 'readSecret' &&
      risk.sinkFn === 'runDangerous',
  ),
).toBe(true);
```

The fixture must route source and sink through a wrapper function:

```ts
export function readSecret() {
  return process.env.TOKEN;
}
export function runDangerous(value: string) {
  exec(value);
}
export function bridge() {
  const value = readSecret();
  runDangerous(value);
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/core/dataflow.test.ts`
Expected: fail because `computeDataflow` does not exist.

- [ ] **Step 3: Implement the minimal dataflow report**

Wrap existing `computeTaint()` into `direct` and `propagated` risks. Add bridge detection by finding functions that can reach at least one source-like function and one sink-like function through calls within the configured depth budget.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- tests/core/dataflow.test.ts`
Expected: pass.

## Task 3: Review Integration

**Files:**

- Modify: `src/core/review.ts`
- Modify: `src/types.ts`
- Test: `tests/core/review.test.ts`

- [ ] **Step 1: Write the failing review test**

Add a test that compares a clean base to a head that introduces the bridge fixture and asserts:

```ts
expect(report.newDataflowRisks.some((risk) => risk.kind === 'bridge')).toBe(true);
expect(report.verdict.decision).toBe('block');
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- tests/core/review.test.ts`
Expected: fail because review reports do not expose `newDataflowRisks`.

- [ ] **Step 3: Wire dataflow into review**

Compute base/head dataflow, diff by stable risk key, filter to touched files, attach `newDataflowRisks`, and include those risks in verdict scoring.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npm test -- tests/core/review.test.ts`
Expected: pass.

## Task 4: CLI and MCP Surfaces

**Files:**

- Create: `src/mcp/tools/semanticGraph.ts`
- Create: `src/mcp/tools/dataflow.ts`
- Modify: `src/mcp/tools.ts`
- Modify CLI registration files under `src/cli`
- Test: `tests/mcp/semanticGraphDataflow.test.ts`
- Test: `tests/cli/semanticGraphDataflow.test.ts`

- [ ] **Step 1: Write failing integration tests**

Assert tools named `projscan_semantic_graph` and `projscan_dataflow` exist and return strict JSON. Assert CLI commands `semantic-graph --format json --quiet` and `dataflow --format json --quiet` return JSON with `schemaVersion: 3` and `risks`.

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- tests/mcp/semanticGraphDataflow.test.ts tests/cli/semanticGraphDataflow.test.ts`
Expected: fail because tools/commands are not registered.

- [ ] **Step 3: Implement MCP and CLI commands**

Follow existing graph/review command patterns. Keep MCP output machine-stable and keep human CLI copy concise.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- tests/mcp/semanticGraphDataflow.test.ts tests/cli/semanticGraphDataflow.test.ts`
Expected: pass.

## Task 5: Release Metadata, Docs, and Bug Hunt

**Files:**

- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/STABILITY.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/mcp-registry/server.json`
- Modify: `tool-manifest.json`

- [ ] **Step 1: Update docs and version metadata**

Document semantic graph, dataflow, review integration, MCP setup, and 3.0 stability expectations. Keep changelog user-facing and omit operational release-bundling language.

- [ ] **Step 2: Run focused checks**

Run:

```bash
npm test -- tests/core/semanticGraph.test.ts tests/core/dataflow.test.ts tests/core/review.test.ts
npm test -- tests/mcp/semanticGraphDataflow.test.ts tests/cli/semanticGraphDataflow.test.ts
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run lint
npm test
npm run build
npm run release:check
```

- [ ] **Step 4: Fix anything found in the bug hunt**

For every failure, capture the symptom, write or adjust a regression test first when behavior changes, then fix and rerun the failing command.

## Self-Review

- Spec coverage: semantic graph contract, review-time dataflow, CLI/MCP/API/docs, release metadata, and bug-hunt work are covered.
- Placeholder scan: no task depends on TBD behavior; every created surface has a test and verification command.
- Type consistency: semantic graph uses `schemaVersion: 3`; review dataflow uses `newDataflowRisks`; CLI/MCP names are `semantic-graph`, `dataflow`, `projscan_semantic_graph`, and `projscan_dataflow`.
