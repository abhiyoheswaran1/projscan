# Agent Trust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 2.1 Agent Trust release surfaces: preflight verdicts, MCP session coordination resources, plugin authoring/test DX, and additive review contract intelligence.

**Architecture:** Keep the new product wedge in small core modules with CLI and MCP adapters over the same functions. Preflight composes existing health, review, taint, changed-file, hotspot, session, memory, and plugin signals instead of adding a separate analysis engine. Plugin scaffolding/test utilities and review contract extraction stay additive and offline-first.

**Tech Stack:** TypeScript, Node 18+, Vitest, Commander CLI, existing MCP stdio server, existing tree-sitter/Babel graph pipeline, local filesystem plugin loading.

---

## File Map

- Create `src/core/preflight.ts`: shared preflight computation, verdict aggregation, required-check status, suggested next actions.
- Create `src/cli/commands/preflight.ts`: `projscan preflight` adapter with compact console output and JSON output.
- Create `src/mcp/tools/preflight.ts`: `projscan_preflight` MCP tool adapter over `computePreflight`.
- Modify `src/types.ts`: add preflight, coordination resource, plugin test, and review contract-diff types.
- Modify `src/cli/index.ts`: register `preflight`.
- Modify `src/mcp/tools.ts`: include `preflightTool`.
- Modify `src/utils/formatSupport.ts`: add `preflight` and plugin subcommand format rows.
- Create `src/core/sessionResources.ts`: summary, handoff, risk-now payloads and conflict detection.
- Modify `src/mcp/resources.ts`: register and read the three new resources.
- Create `src/core/pluginDx.ts`: plugin scaffold writer and plugin test runner.
- Modify `src/cli/commands/plugin.ts`: add `plugin init` and `plugin test`.
- Modify `src/core/review.ts`: attach optional contract changes to review reports.
- Modify `src/types.ts`: add additive review contract fields without changing existing fields.
- Update docs: `README.md`, `docs/GUIDE.md`, `docs/STABILITY.md`, `docs/PLUGIN-AUTHORING.md`, `docs/ROADMAP.md`, `CHANGELOG.md`, `docs/WEBSITE-UPDATE-PROMPT.md`.
- Add tests:
  - `tests/core/preflight.test.ts`
  - `tests/cli/preflight.test.ts`
  - `tests/mcp/preflight.test.ts`
  - `tests/mcp/sessionResources.test.ts`
  - `tests/cli/pluginDx.test.ts`
  - `tests/core/pluginDx.test.ts`
  - Extend `tests/core/review.test.ts`
  - Extend stability, registry, and packed-install tests where user-facing surfaces changed.

## Shared Test Commands

- Focused preflight: `npx vitest run tests/core/preflight.test.ts tests/cli/preflight.test.ts tests/mcp/preflight.test.ts`
- Focused resources: `npx vitest run tests/mcp/sessionResources.test.ts tests/core/session.test.ts`
- Focused plugin DX: `npx vitest run tests/core/pluginDx.test.ts tests/cli/pluginDx.test.ts tests/core/plugins.test.ts tests/cli/pluginReporter.test.ts`
- Focused review intelligence: `npx vitest run tests/core/review.test.ts tests/mcp/server.test.ts`
- Stability: `npm run check:stability`
- Full verification before stopping: `npm run lint`, `npm test`, `npm run check:stability`, `npm run smoke:packed-install`, `npm audit --audit-level=moderate`, `npm pack --dry-run`, `git diff --check`

## Task 0: Contract Types and Baseline Tests

**Files:**
- Modify: `src/types.ts`
- Modify: `src/utils/formatSupport.ts`
- Test: `tests/core/preflight.test.ts`
- Test: `tests/mcp/sessionResources.test.ts`
- Test: `tests/cli/pluginDx.test.ts`
- Test: `tests/core/review.test.ts`

- [ ] **Step 1: Add failing compile-level tests for preflight contracts**

Create `tests/core/preflight.test.ts` with shape assertions that import the future types and expect verdict aggregation behavior:

```ts
import { describe, expect, test } from 'vitest';
import type { PreflightMode, PreflightReport, PreflightReason } from '../../src/types.js';
import { decidePreflightVerdict, summarizePreflight } from '../../src/core/preflight.js';

test('preflight contract supports the three agent modes', () => {
  const modes: PreflightMode[] = ['before_edit', 'before_commit', 'before_merge'];
  expect(modes).toEqual(['before_edit', 'before_commit', 'before_merge']);
});

test('preflight verdict escalates from reasons', () => {
  const warning: PreflightReason = { severity: 'warning', source: 'doctor', message: 'warning' };
  const error: PreflightReason = { severity: 'error', source: 'review', message: 'error' };
  expect(decidePreflightVerdict([])).toBe('proceed');
  expect(decidePreflightVerdict([warning])).toBe('caution');
  expect(decidePreflightVerdict([warning, error])).toBe('block');
});

test('preflight summary is compact and agent-ready', () => {
  const report: PreflightReport = {
    schemaVersion: 1,
    mode: 'before_edit',
    verdict: 'proceed',
    summary: '',
    reasons: [],
    evidence: {},
    requiredChecks: [],
    suggestedNextActions: [],
    toolCalls: [],
  };
  expect(summarizePreflight(report)).toBe('proceed: no blocking or cautionary signals found');
});
```

- [ ] **Step 2: Verify the preflight contract tests fail**

Run: `npx vitest run tests/core/preflight.test.ts`

Expected: FAIL because `src/core/preflight.ts`, `PreflightMode`, `PreflightReport`, `PreflightReason`, `decidePreflightVerdict`, and `summarizePreflight` do not exist yet.

- [ ] **Step 3: Add the public contract types**

Add to `src/types.ts`:

```ts
export type PreflightMode = 'before_edit' | 'before_commit' | 'before_merge';
export type PreflightVerdict = 'proceed' | 'caution' | 'block';
export type PreflightReasonSource =
  | 'doctor'
  | 'review'
  | 'taint'
  | 'session'
  | 'plugin'
  | 'memory'
  | 'changed-files'
  | 'hotspots'
  | 'git'
  | 'format';

export interface PreflightReason {
  severity: IssueSeverity;
  source: PreflightReasonSource;
  message: string;
  file?: string;
  issueId?: string;
  tool?: string;
}

export interface PreflightRequiredCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'unavailable';
  reason?: string;
}

export interface PreflightSuggestedAction {
  label: string;
  command?: string;
  tool?: string;
  args?: Record<string, unknown>;
}

export interface PreflightEvidence {
  health?: { score: number; grade: HealthScore['grade']; errors: number; warnings: number; infos: number };
  changedFiles?: { available: boolean; count: number; files: string[]; reason?: string };
  review?: { available: boolean; verdict?: ReviewReport['verdict']; summary?: string; reason?: string };
  session?: { id: string; touchedFiles: string[]; eventCount: number };
  hotspots?: { touched: Array<{ file: string; riskScore: number }> };
  plugins?: { enabled: boolean; errorIssues: number; warningIssues: number };
}

export interface PreflightReport {
  schemaVersion: 1;
  mode: PreflightMode;
  verdict: PreflightVerdict;
  summary: string;
  reasons: PreflightReason[];
  evidence: PreflightEvidence;
  requiredChecks: PreflightRequiredCheck[];
  suggestedNextActions: PreflightSuggestedAction[];
  toolCalls: PreflightSuggestedAction[];
  truncated?: boolean;
}
```

Also add coordination resource, plugin-test, and review-contract types as additive interfaces:

```ts
export interface SessionResourceSummary { schemaVersion: 1; sessionId: string; touchedFiles: string[]; recentIssues: Issue[]; highRiskTouchedFiles: Array<{ file: string; riskScore: number }>; staleSignals: string[]; truncated?: boolean; }
export interface SessionConflict { kind: 'same-file' | 'import-related' | 'same-workspace' | 'taint-related' | 'hotspot-overlap'; files: string[]; message: string; severity: 'warning' | 'error'; }
export interface SessionHandoff { schemaVersion: 1; summary: SessionResourceSummary; remainingRisks: SessionConflict[]; suggestedNextActions: PreflightSuggestedAction[]; avoidRepeating: string[]; }
export interface RiskNowResource { schemaVersion: 1; conflicts: SessionConflict[]; touchedFiles: string[]; truncated?: boolean; }
export interface PluginTestResult { schemaVersion: 1; manifestPath: string; ok: boolean; diagnostics: Array<{ code: string; severity: IssueSeverity; message: string }>; analyzer?: { issues: Issue[] }; reporter?: { outputs: Array<{ command: string; text: string }> }; }
export interface ReviewContractChange { kind: 'export-added' | 'export-removed' | 'export-renamed' | 'entrypoint-changed' | 'public-export-changed' | 'signature-changed'; file: string; symbol?: string; before?: string; after?: string; confidence: 'high' | 'medium' | 'low'; why: string; }
```

- [ ] **Step 4: Add minimal core helpers**

Create `src/core/preflight.ts` with:

```ts
import type { PreflightReason, PreflightReport, PreflightVerdict } from '../types.js';

export function decidePreflightVerdict(reasons: PreflightReason[]): PreflightVerdict {
  if (reasons.some((reason) => reason.severity === 'error')) return 'block';
  if (reasons.some((reason) => reason.severity === 'warning')) return 'caution';
  return 'proceed';
}

export function summarizePreflight(report: PreflightReport): string {
  if (report.reasons.length === 0) return `${report.verdict}: no blocking or cautionary signals found`;
  return `${report.verdict}: ${report.reasons[0].message}`;
}
```

- [ ] **Step 5: Verify the contract tests pass**

Run: `npx vitest run tests/core/preflight.test.ts`

Expected: PASS for the three contract tests.

- [ ] **Step 6: Bug hunt the contracts**

Run: `rg "schemaVersion: 1|Preflight|SessionResource|ReviewContractChange|PluginTestResult" src tests docs`

Check that the new shapes are additive, JSON-compatible, and do not rename existing review/plugin/session fields.

## Task 1: Agent Safety Gate

**Files:**
- Modify: `src/core/preflight.ts`
- Create: `src/cli/commands/preflight.ts`
- Modify: `src/cli/index.ts`
- Create: `src/mcp/tools/preflight.ts`
- Modify: `src/mcp/tools.ts`
- Modify: `src/utils/formatSupport.ts`
- Test: `tests/core/preflight.test.ts`
- Test: `tests/cli/preflight.test.ts`
- Test: `tests/mcp/preflight.test.ts`

- [ ] **Step 1: Add failing tests for core preflight behavior**

Extend `tests/core/preflight.test.ts`:

```ts
test('before_edit works outside git and returns a complete report', async () => {
  const root = await makeTempProject({ files: { 'package.json': '{"name":"demo","version":"1.0.0"}', 'README.md': '# demo\n', 'src/index.ts': 'export const ok = 1;\n' } });
  const report = await computePreflight(root, { mode: 'before_edit' });
  expect(report.schemaVersion).toBe(1);
  expect(report.mode).toBe('before_edit');
  expect(['proceed', 'caution', 'block']).toContain(report.verdict);
  expect(report.summary).toContain(report.verdict);
});

test('plugin policy errors block preflight', async () => {
  const root = await makeTempProjectWithErrorPlugin();
  const report = await computePreflight(root, { mode: 'before_edit', enablePlugins: true });
  expect(report.verdict).toBe('block');
  expect(report.reasons.some((reason) => reason.source === 'plugin' && reason.severity === 'error')).toBe(true);
});
```

- [ ] **Step 2: Verify the core tests fail**

Run: `npx vitest run tests/core/preflight.test.ts`

Expected: FAIL because `computePreflight` and fixture helpers do not exist yet.

- [ ] **Step 3: Implement `computePreflight`**

In `src/core/preflight.ts`, add:

```ts
export interface ComputePreflightOptions {
  mode?: PreflightMode;
  baseRef?: string;
  headRef?: string;
  maxChangedFiles?: number;
  enablePlugins?: boolean;
}

export async function computePreflight(rootPath: string, options: ComputePreflightOptions = {}): Promise<PreflightReport> {
  const mode = options.mode ?? 'before_edit';
  const scan = await scanRepository(rootPath);
  const issues = await collectIssues(rootPath, scan.files, { enablePlugins: options.enablePlugins });
  const health = calculateScore(issues);
  const changedFiles = await safeChangedFiles(rootPath, mode, options.baseRef);
  const session = await safeSession(rootPath);
  const hotspots = await analyzeHotspots(rootPath, scan.files, issues, { limit: 20 });
  const reasons = buildPreflightReasons({ mode, issues, changedFiles, health, session, hotspots });
  const review = await safeReview(rootPath, mode, options);
  appendReviewReasons(reasons, review);
  const verdict = decidePreflightVerdict(reasons);
  const report = buildPreflightReport({ mode, verdict, reasons, health, changedFiles, session, hotspots, review });
  return { ...report, summary: summarizePreflight(report) };
}
```

Use existing helpers in the repo:

- `scanRepository` from `src/core/repositoryScanner.ts`
- `collectIssues` from `src/core/issueEngine.ts`
- `calculateScore` from `src/utils/scoreCalculator.ts`
- `getChangedFiles` from `src/utils/changedFiles.ts`
- `loadSession` from `src/core/session.ts`
- `analyzeHotspots` from `src/core/hotspotAnalyzer.ts`
- `computeReview` from `src/core/review.ts`

- [ ] **Step 4: Add CLI tests**

Create `tests/cli/preflight.test.ts` with a child-process test that runs:

```ts
const result = await runCli(['preflight', '--mode', 'before_edit', '--format', 'json'], root);
const report = JSON.parse(result.stdout);
expect(report.schemaVersion).toBe(1);
expect(report.mode).toBe('before_edit');
expect(['proceed', 'caution', 'block']).toContain(report.verdict);
```

- [ ] **Step 5: Verify CLI tests fail**

Run: `npx vitest run tests/cli/preflight.test.ts`

Expected: FAIL because the command is not registered.

- [ ] **Step 6: Implement CLI adapter**

Create `src/cli/commands/preflight.ts` with a Commander command:

```ts
program
  .command('preflight')
  .description('Answer whether an agent can safely proceed.')
  .option('--mode <mode>', 'before_edit, before_commit, or before_merge', 'before_edit')
  .option('--base-ref <ref>', 'Base git ref for before_commit/before_merge checks')
  .option('--head-ref <ref>', 'Head git ref for before_merge review checks')
  .option('-f, --format <format>', 'Output format (console, json)', 'console')
  .action(async (options) => { /* validate format, call computePreflight, render */ });
```

Register it in `src/cli/index.ts`, and add `preflight` to `src/utils/formatSupport.ts` as `console` and `json`.

- [ ] **Step 7: Add MCP tests**

Create `tests/mcp/preflight.test.ts` asserting:

```ts
expect(toolNames).toContain('projscan_preflight');
const result = await preflightTool.handler({ mode: 'before_edit' }, context);
expect(result.report.schemaVersion).toBe(1);
expect(result.report.mode).toBe('before_edit');
```

- [ ] **Step 8: Verify MCP tests fail**

Run: `npx vitest run tests/mcp/preflight.test.ts`

Expected: FAIL because `projscan_preflight` is not exported.

- [ ] **Step 9: Implement MCP adapter**

Create `src/mcp/tools/preflight.ts` with `preflightTool`:

```ts
export const preflightTool: McpToolDefinition = {
  name: 'projscan_preflight',
  description: 'Answer whether an agent can safely proceed before edits, commit, or merge.',
  inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['before_edit', 'before_commit', 'before_merge'] }, base_ref: { type: 'string' }, head_ref: { type: 'string' } } },
  handler: async (args, context) => ({ report: await computePreflight(context.rootPath, { mode: args.mode, baseRef: args.base_ref, headRef: args.head_ref }) }),
};
```

Add it to `src/mcp/tools.ts`.

- [ ] **Step 10: Focused verification and bug hunt**

Run:

```bash
npx vitest run tests/core/preflight.test.ts tests/cli/preflight.test.ts tests/mcp/preflight.test.ts
npm run check:stability
node dist/cli/index.js preflight --mode before_edit --format json
```

Expected: focused tests pass; stability either passes or clearly lists the new stable surface, which must then be documented in `docs/STABILITY.md` and the stability fixtures.

## Task 2: Multi-Agent Coordination Resources

**Files:**
- Create: `src/core/sessionResources.ts`
- Modify: `src/mcp/resources.ts`
- Test: `tests/mcp/sessionResources.test.ts`

- [ ] **Step 1: Add failing resource tests**

Create `tests/mcp/sessionResources.test.ts`:

```ts
test('lists agent coordination resources', () => {
  const uris = getResourceDefinitions().map((resource) => resource.uri);
  expect(uris).toContain('projscan://session/summary');
  expect(uris).toContain('projscan://handoff');
  expect(uris).toContain('projscan://risk-now');
});

test('risk-now returns JSON-compatible conflict data', async () => {
  await recordTouch(root, 'src/a.ts', 'test');
  await recordTouch(root, 'src/b.ts', 'test');
  const resource = await readResource('projscan://risk-now', root);
  const payload = JSON.parse(resource.text);
  expect(payload.schemaVersion).toBe(1);
  expect(Array.isArray(payload.conflicts)).toBe(true);
});
```

- [ ] **Step 2: Verify resource tests fail**

Run: `npx vitest run tests/mcp/sessionResources.test.ts`

Expected: FAIL because the resources are not listed/readable.

- [ ] **Step 3: Implement session resource core**

Create `src/core/sessionResources.ts` with:

```ts
export async function buildSessionSummary(rootPath: string): Promise<SessionResourceSummary> { /* load session, scan issues/hotspots, return compact summary */ }
export async function buildHandoff(rootPath: string): Promise<SessionHandoff> { /* summary + conflicts + next actions */ }
export async function buildRiskNow(rootPath: string): Promise<RiskNowResource> { /* conflicts from touched files */ }
export function detectSessionConflicts(files: string[], graph?: CodeGraph): SessionConflict[] { /* same-file, import-related, hotspot-overlap, same-workspace */ }
```

Keep conflict detection deterministic and budget-aware. If graph data is unavailable, return same-file and workspace-level signals only.

- [ ] **Step 4: Register resources**

Modify `src/mcp/resources.ts`:

- add definitions for the three URIs
- route reads to `buildSessionSummary`, `buildHandoff`, and `buildRiskNow`

- [ ] **Step 5: Focused verification and bug hunt**

Run:

```bash
npx vitest run tests/mcp/sessionResources.test.ts tests/core/session.test.ts tests/mcp/server.test.ts
npm run check:stability
```

Bug-hunt cases: empty session, one touched file, multiple touched files, reset session, large touched list with truncation.

## Task 3: Plugin Ecosystem DX

**Files:**
- Create: `src/core/pluginDx.ts`
- Modify: `src/cli/commands/plugin.ts`
- Modify: `src/utils/formatSupport.ts`
- Test: `tests/core/pluginDx.test.ts`
- Test: `tests/cli/pluginDx.test.ts`
- Modify: `scripts/packed-install-smoke.mjs`

- [ ] **Step 1: Add failing core tests**

Create `tests/core/pluginDx.test.ts`:

```ts
test('scaffolds an analyzer plugin that validates and tests cleanly', async () => {
  const result = await initPlugin(root, { kind: 'analyzer', name: 'policy' });
  expect(result.manifestPath).toContain('policy.projscan-plugin.json');
  const testResult = await testPlugin(result.manifestPath, { fixtureRoot: root });
  expect(testResult.ok).toBe(true);
});

test('plugin test reports missing exports with structured diagnostics', async () => {
  const result = await testPlugin(manifestPath, { fixtureRoot: root });
  expect(result.ok).toBe(false);
  expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'PLUGIN_EXPORT_MISSING')).toBe(true);
});
```

- [ ] **Step 2: Verify core tests fail**

Run: `npx vitest run tests/core/pluginDx.test.ts`

Expected: FAIL because `pluginDx.ts` does not exist.

- [ ] **Step 3: Implement scaffolding and test runner**

Create `src/core/pluginDx.ts`:

```ts
export async function initPlugin(rootPath: string, options: { kind: 'analyzer' | 'reporter'; name?: string }): Promise<{ manifestPath: string; modulePath: string }> { /* mkdir .projscan-plugins, refuse overwrite, write manifest + mjs */ }
export async function testPlugin(manifestPath: string, options: { fixtureRoot?: string }): Promise<PluginTestResult> { /* validate, load with execution enabled, run analyzer/reporter fixture */ }
```

Analyzer template should only emit an `info` issue for a marker string such as `PROJSCAN_PLUGIN_EXAMPLE`. Reporter template should return strings for `doctor`, `analyze`, and `ci` payloads.

- [ ] **Step 4: Add failing CLI tests**

Create `tests/cli/pluginDx.test.ts`:

```ts
test('plugin init and plugin test work through the CLI', async () => {
  const init = await runCli(['plugin', 'init', '--kind', 'analyzer', '--name', 'policy'], root);
  expect(init.stdout).toContain('policy.projscan-plugin.json');
  const test = await runCli(['plugin', 'test', '.projscan-plugins/policy.projscan-plugin.json', '--format', 'json'], root);
  expect(JSON.parse(test.stdout).ok).toBe(true);
});
```

- [ ] **Step 5: Verify CLI tests fail**

Run: `npx vitest run tests/cli/pluginDx.test.ts`

Expected: FAIL because the plugin subcommands are not present.

- [ ] **Step 6: Add CLI subcommands**

Modify `src/cli/commands/plugin.ts`:

- `plugin init --kind analyzer|reporter --name <name> --format console|json`
- `plugin test <manifest> --fixture <path> --format console|json`
- exit non-zero on `PluginTestResult.ok === false`

- [ ] **Step 7: Packed-install coverage**

Extend `scripts/packed-install-smoke.mjs` to run:

```bash
projscan plugin init --kind analyzer --name packed-policy
projscan plugin test .projscan-plugins/packed-policy.projscan-plugin.json --format json
```

- [ ] **Step 8: Focused verification and bug hunt**

Run:

```bash
npx vitest run tests/core/pluginDx.test.ts tests/cli/pluginDx.test.ts tests/core/plugins.test.ts tests/cli/pluginReporter.test.ts
npm run smoke:packed-install
```

Bug-hunt cases: existing manifest, malformed analyzer issue, reporter throws, unsupported reporter command, packed install path resolution.

## Task 4: Deeper Review Intelligence

**Files:**
- Modify: `src/types.ts`
- Modify: `src/core/review.ts`
- Optionally modify: `src/core/prDiff.ts`
- Test: `tests/core/review.test.ts`
- Test: `tests/mcp/server.test.ts`

- [ ] **Step 1: Add failing review tests**

Extend `tests/core/review.test.ts`:

```ts
test('review reports exported symbol contract changes', async () => {
  const review = await computeReview(root, { baseRef, headRef });
  expect(review.contractChanges).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'export-removed', symbol: 'oldApi', confidence: 'high' }),
    ]),
  );
});

test('review reports package entrypoint changes', async () => {
  const review = await computeReview(root, { baseRef, headRef });
  expect(review.contractChanges).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'entrypoint-changed', file: 'package.json', before: './old.js', after: './new.js' }),
    ]),
  );
});
```

- [ ] **Step 2: Verify review tests fail**

Run: `npx vitest run tests/core/review.test.ts`

Expected: FAIL because `contractChanges` does not exist.

- [ ] **Step 3: Implement contract extraction**

In `src/core/review.ts`, after PR diff and dependency diff are available, build:

```ts
function buildContractChanges(reviewInputs): ReviewContractChange[] {
  return [
    ...exportChangesFromFileDiff(prDiff.filesModified),
    ...entrypointChangesFromManifestDiff(dependencyChanges),
  ];
}
```

Map existing `FileAstDiff.exportsAdded`, `exportsRemoved`, and `exportsRenamed` into `export-added`, `export-removed`, and `export-renamed`. Extend manifest snapshot/diff logic to include `main`, `module`, `types`, `exports`, and `bin`; emit `entrypoint-changed` and `public-export-changed` without changing existing dependency fields.

- [ ] **Step 4: Add why-this-matters text**

Each contract change must include a short rule-driven `why`, for example:

```ts
`Export "${symbol}" was removed from ${file}; downstream imports can fail at runtime or compile time.`
```

- [ ] **Step 5: Focused verification and bug hunt**

Run:

```bash
npx vitest run tests/core/review.test.ts tests/mcp/server.test.ts tests/mcp/reviewWatch.test.ts
```

Bug-hunt cases: added export only, removed export only, rename-like change, function body-only change, package entrypoint change, monorepo package entrypoint change, large PR with many export changes.

## Task 5: Docs, Changelog, and Stability

**Files:**
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/STABILITY.md`
- Modify: `docs/PLUGIN-AUTHORING.md`
- Modify: `docs/ROADMAP.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/WEBSITE-UPDATE-PROMPT.md`
- Modify: `.github/mcp-registry/server.json` only if description/tool copy must change, keeping registry validation limits.
- Test: `tests/mcp/registryDescriptor.test.ts`
- Test: `tests/mcp/releaseWorkflow.test.ts`

- [ ] **Step 1: Add failing doc/stability expectations**

Update existing tests to expect:

- `projscan preflight` in README and Guide
- `projscan_preflight` in stable MCP surfaces
- three new resource URIs in stability docs
- plugin `init` and `test` docs in plugin authoring
- Agent Trust copy in website prompt

- [ ] **Step 2: Verify doc tests fail**

Run: `npx vitest run tests/mcp/registryDescriptor.test.ts tests/mcp/releaseWorkflow.test.ts`

Expected: FAIL until docs are updated.

- [ ] **Step 3: Update documentation**

Update docs with concrete examples:

```bash
projscan preflight --mode before_edit --format json
projscan preflight --mode before_commit --base-ref main --format json
projscan plugin init --kind analyzer --name policy
projscan plugin test .projscan-plugins/policy.projscan-plugin.json --format json
```

Keep release language under Unreleased/2.1.0 until explicit release approval. Do not bump package version.

- [ ] **Step 4: Focused verification and bug hunt**

Run:

```bash
npx vitest run tests/mcp/registryDescriptor.test.ts tests/mcp/releaseWorkflow.test.ts tests/cli/formatHandling.test.ts
npm run check:stability
```

Bug-hunt cases: command examples match actual CLI flags, registry description remains <= 100 characters, website prompt does not claim unreleased publishing.

## Task 6: Final Cross-Surface Bug Hunt

**Files:**
- All changed files.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run lint
npm test
npm run check:stability
npm run smoke:packed-install
npm audit --audit-level=moderate
npm pack --dry-run
git diff --check
```

- [ ] **Step 2: Run projscan against itself**

After `npm run build`, run:

```bash
node dist/cli/index.js doctor --format json
node dist/cli/index.js preflight --mode before_edit --format json
node dist/cli/index.js plugin test docs/examples/plugins/policy.projscan-plugin.json --format json
```

- [ ] **Step 3: Validate MCP Registry descriptor**

Run:

```bash
~/bin/mcp-publisher validate .github/mcp-registry/server.json
```

If the token is expired, do not publish; validation does not require publishing.

- [ ] **Step 4: Final diff review**

Run:

```bash
git status --short --branch
git diff --stat
git diff -- src tests docs scripts package.json .github .github/mcp-registry/server.json
```

Confirm no version bump, tag, push, npm publish, or MCP registry publish occurred.

- [ ] **Step 5: Stop for release approval**

Report verification evidence and wait for explicit user approval before:

- bumping package version
- updating lockfile version for release
- tagging
- pushing
- publishing npm
- publishing MCP Registry descriptor
- updating website production copy
