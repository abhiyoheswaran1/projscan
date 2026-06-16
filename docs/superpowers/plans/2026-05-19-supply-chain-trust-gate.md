# Supply-Chain Trust Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a release-blocking and agent-visible supply-chain trust gate for known malicious package indicators and risky dependency/persistence patterns.

**Architecture:** Implement the detector as a normal projscan analyzer, then let doctor and preflight consume the same `Issue` stream. Keep the release gate as a thin script over the built analyzer plus npm audit/signature checks so CI/release and product behavior share core logic.

**Tech Stack:** TypeScript analyzer code, Vitest, Node.js release scripts, GitHub Actions, npm audit/signature verification, CycloneDX SBOM generation through `npx`.

---

### Task 1: Lock the Desired Behavior With Failing Tests

**Files:**

- Modify: `tests/core/preflight.test.ts`
- Modify: `tests/mcp/releaseWorkflow.test.ts`

- [ ] **Step 1: Add preflight fixture tests**

Add tests that create temporary projects containing a known malicious `@tanstack/react-router` version, a GitHub optional dependency, a `postinstall` script, and a `.vscode/tasks.json` persistence hook. Assert that `computePreflight(..., { mode: 'before_edit' })` blocks for known malicious IOCs and hidden persistence hooks, and cautions for risky dependency/script patterns.

- [ ] **Step 2: Add release workflow tests**

Assert that `package.json` exposes `security:release-gate`, CI calls it, release calls it before publishing, release has `id-token: write`, release generates an SBOM, and release uploads the SBOM asset.

- [ ] **Step 3: Run focused tests and observe failure**

Run `npm test -- tests/core/preflight.test.ts tests/mcp/releaseWorkflow.test.ts`. Expected: failures because the analyzer, script, and workflow wiring do not exist yet.

### Task 2: Implement the Analyzer and Preflight Surface

**Files:**

- Create: `src/analyzers/supplyChainCheck.ts`
- Modify: `src/core/issueEngine.ts`
- Modify: `src/core/preflight.ts`
- Modify: `src/types.ts`

- [ ] **Step 1: Add `supplyChainCheck`**

Implement offline checks for malicious package/version IOCs, malicious filenames/content IOCs, risky git dependencies, lifecycle scripts, hidden persistence hooks, and large obfuscated JS payloads.

- [ ] **Step 2: Register analyzer**

Import and add `supplyChainCheck` to the `checkers` array in `src/core/issueEngine.ts`.

- [ ] **Step 3: Add preflight source and evidence**

Add `supply-chain` to `PreflightReasonSource`, add `evidence.supplyChain`, and push preflight reasons for supply-chain issues. Errors block; warnings caution.

- [ ] **Step 4: Run focused tests**

Run `npm test -- tests/core/preflight.test.ts`. Expected: pass.

### Task 3: Add the Release Gate Script

**Files:**

- Create: `scripts/release-gate.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add script**

Add `security:release-gate` to `package.json` with `node scripts/release-gate.mjs`.

- [ ] **Step 2: Implement gate**

Use built `dist` modules to scan the current repository and run the supply-chain analyzer. Fail on analyzer errors. Then run `npm audit --audit-level=moderate` and `npm audit signatures`; fail if either command fails.

- [ ] **Step 3: Run focused gate**

Run `npm run build` and `npm run security:release-gate`. Expected after dependency audit fix: pass.

### Task 4: Wire CI, Release, SBOM, and Audit Fix

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add CI/release gate calls**

Run `npm run security:release-gate` in CI after build and before release publish.

- [ ] **Step 2: Add SBOM generation/upload**

Generate a CycloneDX SBOM during release and upload it to the GitHub Release along with `dist/tool-manifest.json`.

- [ ] **Step 3: Fix current audit issue**

Update the `brace-expansion` override to a non-vulnerable version range and refresh `package-lock.json` so `npm audit --audit-level=moderate` passes.

- [ ] **Step 4: Run workflow tests**

Run `npm test -- tests/mcp/releaseWorkflow.test.ts`. Expected: pass.

### Task 5: Full Verification

**Files:**

- No new files.

- [ ] **Step 1: Run focused tests**

Run `npm test -- tests/core/preflight.test.ts tests/mcp/releaseWorkflow.test.ts tests/cli/preflight.test.ts`.

- [ ] **Step 2: Run build and full tests**

Run `npm run build`, `npm test`, `npm run lint`, and `npm run check:stability`.

- [ ] **Step 3: Run security checks**

Run `npm audit --audit-level=moderate`, `npm audit signatures`, and `npm run security:release-gate`.

- [ ] **Step 4: Inspect git diff**

Run `git diff --stat` and `git diff -- package.json .github/workflows/release.yml src/analyzers/supplyChainCheck.ts src/core/preflight.ts`.
