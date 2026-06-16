# projscan 3.4.0 Understand Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship one high-value repo-comprehension release centered on `projscan understand` for real engineers who need file-backed system understanding and change safety.

**Architecture:** Add one additive core report module that composes existing scan, graph, semantic graph, dataflow, hotspot, coverage, ownership, changed-file, and preflight primitives. Expose it through a CLI command and MCP tool without breaking existing schemas, then update release metadata and docs to `3.4.0`.

**Tech Stack:** TypeScript, Vitest, Commander CLI, MCP tool registry, Markdown docs, npm release metadata.

---

### Task 1: Core Understand Report

**Files:**

- Modify: `src/types.ts`
- Create: `src/core/understand.ts`
- Test: `tests/core/understand.test.ts`

- [x] **Step 1: Write failing core tests**

Create `tests/core/understand.test.ts` with fixtures that prove:

- `computeUnderstandReport(root, { view: 'map' })` returns entrypoints, boundaries, read-first files, risks, and cited claims.
- `view: 'flow'` returns runtime flow evidence from entrypoints to sinks.
- `view: 'contracts'` returns public exports, config/env contracts, and breaking-change risks.
- `view: 'change'` uses an intent string plus changed files to produce blast radius, safe edit, owners, tests, rollback, and verification commands.
- `view: 'verify'` returns minimal/focused/full verification tiers and direct-test gaps.

- [x] **Step 2: Verify red**

Run:

```bash
npx vitest run tests/core/understand.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: failure because `src/core/understand.ts` and understand types do not exist.

- [x] **Step 3: Implement minimal core**

Implement:

- `UnderstandView = 'map' | 'flow' | 'contracts' | 'change' | 'verify'`
- `UnderstandReport` with `schemaVersion`, `view`, `summary`, `claims`, `entrypoints`, `boundaries`, `flows`, `contracts`, `changeReadiness`, `verification`, `readFirst`, `risks`, `unknowns`, and `commands`.
- `computeUnderstandReport(rootPath, options)` that builds evidence from existing repo scan, code graph, semantic graph, dataflow, hotspots, changed files, preflight, and package metadata.
- Claim helper that requires every architecture claim to include file/symbol citations or land in `unknowns`.

- [x] **Step 4: Verify green**

Run:

```bash
npx vitest run tests/core/understand.test.ts --test-timeout 60000 --hook-timeout 60000
npm run build
```

Expected: core tests pass and TypeScript compiles.

### Task 2: CLI and MCP Surface

**Files:**

- Create: `src/cli/commands/understand.ts`
- Modify: `src/cli/index.ts`
- Create: `src/mcp/tools/understand.ts`
- Modify: `src/mcp/tools.ts`
- Modify: `src/utils/formatSupport.ts`
- Test: `tests/cli/understand.test.ts`
- Test: `tests/mcp/understand.test.ts`

- [x] **Step 1: Write failing CLI/MCP tests**

Add tests that prove:

- `projscan understand --view map --format json --quiet` returns the report.
- `projscan understand --view change --intent "rename auth client" --format json --quiet` preserves the intent and returns change-readiness commands.
- Console output includes `Read First`, `Claims`, `Unknowns`, and `Next Commands`.
- Unsupported formats fail through the shared matrix.
- MCP `projscan_understand` returns the same report shape.

- [x] **Step 2: Verify red**

Run:

```bash
npm run build
npx vitest run tests/cli/understand.test.ts tests/mcp/understand.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: build or tests fail because the command/tool are not registered.

- [x] **Step 3: Implement surfaces**

Add:

- CLI command `understand` with `--view`, `--intent`, `--max-items`, and shared `--format`.
- MCP tool `projscan_understand` with `view`, `intent`, `max_items`, and `max_tokens`.
- Format support for console/json/markdown where existing command support allows it; start with console/json if markdown is not locally supported by command metadata.

- [x] **Step 4: Verify green**

Run:

```bash
npm run build
npx vitest run tests/cli/understand.test.ts tests/mcp/understand.test.ts --test-timeout 60000 --hook-timeout 60000
```

Expected: CLI and MCP tests pass.

### Task 3: Release Metadata and Docs

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/mcp-registry/server.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`

- [x] **Step 1: Version sync**

Set package, lockfile, and MCP Registry versions to `3.4.0`. Update README release badge/tag links from `v3.3.0` to `v3.4.0`.

- [x] **Step 2: Exact changelog/docs**

Add a `3.4.0` changelog entry listing what shipped:

- repo map
- flow map
- contract map
- change-readiness map
- verification map
- CLI and MCP understand surfaces
- cited claims and unknowns

Do not describe the release as combining multiple planned releases.

- [x] **Step 3: Website prompt**

Update `docs/WEBSITE-UPDATE-PROMPT.md` to target `projscan 3.4.0` and highlight the concrete understand capabilities.

### Task 4: Release Verification

**Files:**

- Verify only unless a gate fails.

- [x] **Step 1: Focused verification**

Run:

```bash
npx vitest run tests/core/understand.test.ts tests/cli/understand.test.ts tests/mcp/understand.test.ts --test-timeout 60000 --hook-timeout 60000
```

- [x] **Step 2: Release gates**

Run:

```bash
npm test
npm run build
npm run lint
npm run check:stability
npm run check:graph-corpus
npm run release:check -- --skip-remote
```

Expected: all local gates pass before tagging `v3.4.0`.
