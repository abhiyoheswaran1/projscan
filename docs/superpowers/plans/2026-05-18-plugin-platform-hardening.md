# Plugin Platform Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the 1.10 analyzer plugin preview into a 2.0-ready platform contract without bumping, tagging, publishing, or starting release prep.

**Architecture:** Keep `src/core/plugins.ts` as the source of truth for plugin validation, discovery, loading, execution, and output shape checks. CLI and MCP plugin tools should become thin formatters over structured core diagnostics. The shared `collectIssues()` path remains the only place plugin analyzer output enters `doctor`, `ci`, `analyze`, and MCP health tools.

**Tech Stack:** TypeScript, Node.js ESM, Commander CLI, MCP tool handlers, Vitest, projscan local CLI verification.

---

## File Structure

- Modify `src/core/plugins.ts`: add structured diagnostics while preserving existing `reason` and `error` string fields for compatibility.
- Modify `src/cli/commands/plugin.ts`: render structured diagnostics in console and JSON modes; resolve validate paths relative to the repo root.
- Modify `src/mcp/tools/plugin.ts`: return the same diagnostic shape as the CLI JSON mode and resolve repo-relative validate paths.
- Modify `tests/core/plugins.test.ts`: extend current unit coverage for diagnostic details and read/discovery behavior.
- Create `tests/core/pluginPipeline.test.ts`: prove enabled plugin analyzer issues flow through `collectIssues()` and scoring; prove disabled plugins stay inactive.
- Create `tests/mcp/plugin.test.ts`: prove `projscan_plugin` list/validate returns structured diagnostics through the MCP server.
- Create `docs/PLUGIN-AUTHORING.md`: document manifest shape, analyzer module shape, validation, enablement, issue output, and trust model.
- Modify `README.md`, `docs/GUIDE.md`, `docs/ROADMAP.md`: link to the plugin authoring guide from existing plugin sections.
- Do not modify `package.json`, `package-lock.json`, `.github/mcp-registry/server.json`, release tags, npm state, or GitHub Release state.

## Task 1: Structured Manifest Diagnostics

**Files:**
- Modify: `src/core/plugins.ts`
- Modify: `tests/core/plugins.test.ts`

- [ ] **Step 1: Write failing tests for structured validation errors**

Add these assertions to `tests/core/plugins.test.ts` inside `describe('plugins - validateManifest', ...)` after the existing invalid tests:

```ts
  it('returns structured diagnostics for invalid manifests', () => {
    const missingName = validateManifest({
      schemaVersion: 1,
      kind: 'analyzer',
      module: './check.mjs',
      category: 'custom',
    });
    expect(missingName.ok).toBe(false);
    if (!missingName.ok) {
      expect(missingName.reason).toMatch(/name/);
      expect(missingName.diagnostic).toMatchObject({
        code: 'invalid-name',
        field: 'name',
      });
      expect(missingName.diagnostic.hint).toMatch(/1-65/);
    }

    const wrongVersion = validateManifest({
      schemaVersion: 2,
      name: 'p',
      kind: 'analyzer',
      module: './check.mjs',
      category: 'custom',
    });
    expect(wrongVersion.ok).toBe(false);
    if (!wrongVersion.ok) {
      expect(wrongVersion.diagnostic).toMatchObject({
        code: 'unsupported-schema-version',
        field: 'schemaVersion',
      });
      expect(wrongVersion.diagnostic.message).toContain('expected 1');
    }
  });
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```sh
npm test -- tests/core/plugins.test.ts
```

Expected: FAIL because `ValidationFail` does not expose `diagnostic`.

- [ ] **Step 3: Add diagnostic types and helpers**

In `src/core/plugins.ts`, replace the current validation result interfaces:

```ts
interface ValidationOk {
  ok: true;
  manifest: PluginManifest;
}
interface ValidationFail {
  ok: false;
  reason: string;
}
```

with:

```ts
export interface PluginDiagnostic {
  code:
    | 'invalid-manifest'
    | 'unsupported-schema-version'
    | 'invalid-name'
    | 'unsupported-kind'
    | 'invalid-module'
    | 'invalid-category'
    | 'invalid-description'
    | 'invalid-json'
    | 'read-error';
  message: string;
  field?: string;
  hint?: string;
}

interface ValidationOk {
  ok: true;
  manifest: PluginManifest;
}
interface ValidationFail {
  ok: false;
  reason: string;
  diagnostic: PluginDiagnostic;
}

function failValidation(diagnostic: PluginDiagnostic): ValidationFail {
  return { ok: false, reason: diagnostic.message, diagnostic };
}
```

- [ ] **Step 4: Return structured diagnostics from `validateManifest`**

In `src/core/plugins.ts`, update every `return { ok: false, reason: ... }` in `validateManifest()` to use `failValidation(...)`. Use these exact diagnostics:

```ts
  if (!input || typeof input !== 'object') {
    return failValidation({
      code: 'invalid-manifest',
      message: 'manifest must be a JSON object',
      hint: 'Use an object with schemaVersion, name, kind, module, and category fields.',
    });
  }
```

```ts
    return failValidation({
      code: 'unsupported-schema-version',
      field: 'schemaVersion',
      message: `unsupported schemaVersion ${String(obj.schemaVersion)}; expected ${PLUGIN_SCHEMA_VERSION}`,
      hint: `Set "schemaVersion": ${PLUGIN_SCHEMA_VERSION}.`,
    });
```

```ts
    return failValidation({
      code: 'invalid-name',
      field: 'name',
      message: 'name is required and must be 1-65 chars of [a-z0-9._/-]',
      hint: 'Use a stable plugin id such as "team/no-console" or "my-plugin".',
    });
```

```ts
    return failValidation({
      code: 'unsupported-kind',
      field: 'kind',
      message: 'only kind:"analyzer" is supported in the plugin preview',
      hint: 'Set "kind": "analyzer".',
    });
```

```ts
    return failValidation({
      code: 'invalid-module',
      field: 'module',
      message: 'module is required and must be a relative path',
      hint: 'Point to a local module inside the same plugin directory, for example "./check.mjs".',
    });
```

```ts
    return failValidation({
      code: 'invalid-module',
      field: 'module',
      message: 'module must be a relative path inside the plugin dir',
      hint: 'Do not use absolute paths or any ".." path segment.',
    });
```

```ts
    return failValidation({
      code: 'invalid-category',
      field: 'category',
      message: 'category is required',
      hint: 'Use the fallback Issue.category for this plugin, for example "custom" or "security".',
    });
```

```ts
    return failValidation({
      code: 'invalid-description',
      field: 'description',
      message: 'description must be a string when provided',
    });
```

- [ ] **Step 5: Run focused test and verify it passes**

Run:

```sh
npm test -- tests/core/plugins.test.ts
```

Expected: PASS.

## Task 2: Discovery Diagnostics for Read and JSON Failures

**Files:**
- Modify: `src/core/plugins.ts`
- Modify: `tests/core/plugins.test.ts`

- [ ] **Step 1: Write failing discovery tests**

In `tests/core/plugins.test.ts`, update the existing invalid JSON test to assert diagnostics:

```ts
  it('surfaces invalid JSON with structured diagnostics without throwing', async () => {
    const dir = path.join(tmp, PLUGIN_DIR);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'broken.projscan-plugin.json'), '{ not json', 'utf-8');
    const entries = await discoverPluginManifests(tmp);
    expect(entries).toHaveLength(1);
    expect(entries[0].manifest).toBeNull();
    expect(entries[0].error).toMatch(/invalid JSON/);
    expect(entries[0].diagnostic).toMatchObject({
      code: 'invalid-json',
    });
  });
```

Add a second test in `describe('plugins - discoverPluginManifests', ...)`:

```ts
  it('surfaces validation diagnostics on discovered manifests', async () => {
    await writeManifest('bad', {
      schemaVersion: 1,
      name: 'bad plugin with spaces',
      kind: 'analyzer',
      module: './bad.mjs',
      category: 'custom',
    });
    const entries = await discoverPluginManifests(tmp);
    expect(entries).toHaveLength(1);
    expect(entries[0].manifest).toBeNull();
    expect(entries[0].diagnostic).toMatchObject({
      code: 'invalid-name',
      field: 'name',
    });
  });
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```sh
npm test -- tests/core/plugins.test.ts
```

Expected: FAIL because `PluginDiscoveryEntry` does not expose `diagnostic`.

- [ ] **Step 3: Add diagnostics to discovery entries**

In `src/core/plugins.ts`, modify `PluginDiscoveryEntry`:

```ts
export interface PluginDiscoveryEntry {
  manifestPath: string;
  manifest: PluginManifest | null;
  /** Set when the manifest failed to parse or validate. */
  error?: string;
  diagnostic?: PluginDiagnostic;
}
```

In `discoverPluginManifests()`, change invalid JSON handling to:

```ts
      const message = `invalid JSON: ${err instanceof Error ? err.message : String(err)}`;
      out.push({
        manifestPath,
        manifest: null,
        error: message,
        diagnostic: {
          code: 'invalid-json',
          message,
          hint: 'Fix the manifest so it is valid JSON.',
        },
      });
```

Change read error handling to:

```ts
      const message = `unable to read manifest: ${err instanceof Error ? err.message : String(err)}`;
      out.push({
        manifestPath,
        manifest: null,
        error: message,
        diagnostic: {
          code: 'read-error',
          message,
          hint: 'Check file permissions and try again.',
        },
      });
```

Change validation failure handling to:

```ts
    if (!validation.ok) {
      out.push({
        manifestPath,
        manifest: null,
        error: validation.reason,
        diagnostic: validation.diagnostic,
      });
      continue;
    }
```

- [ ] **Step 4: Run focused test and verify it passes**

Run:

```sh
npm test -- tests/core/plugins.test.ts
```

Expected: PASS.

## Task 3: Shared Manifest File Reader

**Files:**
- Modify: `src/core/plugins.ts`
- Modify: `tests/core/plugins.test.ts`

- [ ] **Step 1: Write failing tests for file validation**

Import the new function in `tests/core/plugins.test.ts`:

```ts
  readPluginManifestFile,
```

Add this describe block before `describe('plugins - loadPlugins', ...)`:

```ts
describe('plugins - readPluginManifestFile', () => {
  it('validates a manifest file and returns the parsed manifest', async () => {
    const manifestPath = await writeManifest('file-ok', {
      schemaVersion: 1,
      name: 'file-ok',
      kind: 'analyzer',
      module: './check.mjs',
      category: 'custom',
    });
    const result = await readPluginManifestFile(manifestPath);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.name).toBe('file-ok');
  });

  it('returns structured diagnostics for invalid JSON', async () => {
    const dir = path.join(tmp, PLUGIN_DIR);
    await fs.mkdir(dir, { recursive: true });
    const manifestPath = path.join(dir, 'broken.projscan-plugin.json');
    await fs.writeFile(manifestPath, '{ not json', 'utf-8');
    const result = await readPluginManifestFile(manifestPath);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostic).toMatchObject({ code: 'invalid-json' });
      expect(result.reason).toMatch(/invalid JSON/);
    }
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```sh
npm test -- tests/core/plugins.test.ts
```

Expected: FAIL because `readPluginManifestFile` is not exported.

- [ ] **Step 3: Implement `readPluginManifestFile`**

In `src/core/plugins.ts`, add these exported types after `PluginDiscoveryEntry`:

```ts
export type PluginManifestFileResult =
  | { ok: true; manifest: PluginManifest }
  | { ok: false; reason: string; diagnostic: PluginDiagnostic };
```

Add this function before `discoverPluginManifests()`:

```ts
export async function readPluginManifestFile(manifestPath: string): Promise<PluginManifestFileResult> {
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf-8');
  } catch (err) {
    const message = `unable to read manifest: ${err instanceof Error ? err.message : String(err)}`;
    return {
      ok: false,
      reason: message,
      diagnostic: {
        code: 'read-error',
        message,
        hint: 'Check file permissions and try again.',
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const message = `invalid JSON: ${err instanceof Error ? err.message : String(err)}`;
    return {
      ok: false,
      reason: message,
      diagnostic: {
        code: 'invalid-json',
        message,
        hint: 'Fix the manifest so it is valid JSON.',
      },
    };
  }

  const validation = validateManifest(parsed);
  return validation.ok
    ? { ok: true, manifest: validation.manifest }
    : { ok: false, reason: validation.reason, diagnostic: validation.diagnostic };
}
```

- [ ] **Step 4: Refactor discovery to use the shared reader**

Replace the read/parse/validate block inside `discoverPluginManifests()` with:

```ts
    const result = await readPluginManifestFile(manifestPath);
    if (!result.ok) {
      out.push({
        manifestPath,
        manifest: null,
        error: result.reason,
        diagnostic: result.diagnostic,
      });
      continue;
    }
    out.push({ manifestPath, manifest: result.manifest });
```

- [ ] **Step 5: Run focused test and verify it passes**

Run:

```sh
npm test -- tests/core/plugins.test.ts
```

Expected: PASS.

## Task 4: CLI and MCP Diagnostic Output

**Files:**
- Modify: `src/cli/commands/plugin.ts`
- Modify: `src/mcp/tools/plugin.ts`
- Create: `tests/mcp/plugin.test.ts`

- [ ] **Step 1: Write failing MCP tests**

Create `tests/mcp/plugin.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createMcpServer } from '../../src/mcp/server.js';

let tmp: string;
let originalFlag: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-plugin-mcp-'));
  originalFlag = process.env.PROJSCAN_PLUGINS_PREVIEW;
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0' }));
  await fs.mkdir(path.join(tmp, '.projscan-plugins'), { recursive: true });
});

afterEach(async () => {
  if (originalFlag === undefined) delete process.env.PROJSCAN_PLUGINS_PREVIEW;
  else process.env.PROJSCAN_PLUGINS_PREVIEW = originalFlag;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function init(server: ReturnType<typeof createMcpServer>): Promise<void> {
  await server.handleMessage(JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'initialize', params: {} }));
}

async function call(server: ReturnType<typeof createMcpServer>, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const raw = await server.handleMessage(
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  );
  if (!raw) throw new Error('no response');
  const env = JSON.parse(raw) as { result: { content: Array<{ text: string }> } };
  return JSON.parse(env.result.content[0].text);
}

describe('projscan_plugin MCP tool', () => {
  it('returns structured diagnostics from validate', async () => {
    const manifestPath = path.join(tmp, '.projscan-plugins', 'bad.projscan-plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify({ schemaVersion: 1, name: 'bad plugin', kind: 'analyzer', module: './check.mjs', category: 'custom' }),
    );
    const server = createMcpServer(tmp);
    await init(server);
    const result = await call(server, 'projscan_plugin', {
      action: 'validate',
      manifest_path: '.projscan-plugins/bad.projscan-plugin.json',
    });
    expect(result).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'invalid-name',
        field: 'name',
      },
    });
    server.close();
  });

  it('includes diagnostics in list results', async () => {
    await fs.writeFile(path.join(tmp, '.projscan-plugins', 'broken.projscan-plugin.json'), '{ not json', 'utf-8');
    const server = createMcpServer(tmp);
    await init(server);
    const result = await call(server, 'projscan_plugin', { action: 'list' });
    const plugins = result.plugins as Array<Record<string, unknown>>;
    expect(plugins[0]).toMatchObject({
      ok: false,
      diagnostic: {
        code: 'invalid-json',
      },
    });
    server.close();
  });
});
```

- [ ] **Step 2: Run MCP plugin tests and verify they fail**

Run:

```sh
npm test -- tests/mcp/plugin.test.ts
```

Expected: FAIL because MCP output does not include `diagnostic` and validate does not resolve repo-relative paths.

- [ ] **Step 3: Update CLI command to use shared file reader**

In `src/cli/commands/plugin.ts`, update imports:

```ts
import path from 'node:path';
import {
  PLUGIN_PREVIEW_FLAG,
  discoverPluginManifests,
  pluginsEnabled,
  readPluginManifestFile,
  type PluginDiagnostic,
} from '../../core/plugins.js';
```

Remove the `fs` import and the `validateManifest` import.

Add this helper near the bottom:

```ts
function resolveManifestPath(rootPath: string, manifestPath: string): string {
  return path.isAbsolute(manifestPath) ? manifestPath : path.resolve(rootPath, manifestPath);
}

function printDiagnostic(diagnostic: PluginDiagnostic): void {
  console.error(chalk.red(`      [${diagnostic.code}] ${diagnostic.message}`));
  if (diagnostic.hint) console.error(chalk.dim(`      hint: ${diagnostic.hint}`));
}
```

In `runList()`, add `diagnostic: e.diagnostic` to each JSON plugin entry. In console mode, replace `console.log(chalk.red(...e.error...))` for invalid entries with:

```ts
      if (e.diagnostic) printDiagnostic(e.diagnostic);
      else console.log(chalk.red(`      ${e.error}`));
```

In `runValidate()`, replace manual file read / JSON parse / validate logic with:

```ts
  const rootPath = getRootPath();
  const resolvedManifestPath = resolveManifestPath(rootPath, manifestPath);
  const result = await readPluginManifestFile(resolvedManifestPath);
  if (format === 'json') {
    console.log(
      JSON.stringify(
        result.ok
          ? { ok: true, manifest: result.manifest }
          : { ok: false, error: result.reason, diagnostic: result.diagnostic },
        null,
        2,
      ),
    );
    if (!result.ok) process.exit(1);
    return;
  }
  if (result.ok) {
    console.log(chalk.green(`✓ ${manifestPath} validates against schema v${result.manifest.schemaVersion}.`));
  } else {
    console.error(chalk.red(`✗ ${manifestPath}: ${result.reason}`));
    printDiagnostic(result.diagnostic);
    process.exit(1);
  }
```

- [ ] **Step 4: Update MCP tool to use shared file reader**

In `src/mcp/tools/plugin.ts`, update imports:

```ts
import path from 'node:path';
import {
  PLUGIN_PREVIEW_FLAG,
  discoverPluginManifests,
  pluginsEnabled,
  readPluginManifestFile,
} from '../../core/plugins.js';
```

Remove `fs` and `validateManifest`.

In list output, add `diagnostic: e.diagnostic` for invalid entries:

```ts
              : { error: e.error, diagnostic: e.diagnostic }),
```

In the validate branch, replace manual read/parse/validate with:

```ts
        const manifestPath = path.isAbsolute(p) ? p : path.resolve(rootPath, p);
        const result = await readPluginManifestFile(manifestPath);
        return result.ok
          ? { ok: true, manifest: result.manifest }
          : { ok: false, error: result.reason, diagnostic: result.diagnostic };
```

- [ ] **Step 5: Run focused MCP test and plugin tests**

Run:

```sh
npm test -- tests/core/plugins.test.ts tests/mcp/plugin.test.ts
```

Expected: PASS.

## Task 5: Full Analyzer Pipeline Proof

**Files:**
- Create: `tests/core/pluginPipeline.test.ts`

- [ ] **Step 1: Write failing pipeline tests**

Create `tests/core/pluginPipeline.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { collectIssues } from '../../src/core/issueEngine.js';
import { calculateScore } from '../../src/utils/scoreCalculator.js';

let tmp: string;
let originalFlag: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-plugin-pipeline-'));
  originalFlag = process.env.PROJSCAN_PLUGINS_PREVIEW;
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.0.0' }));
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'a.ts'), 'export const a = 1;\n');
  await fs.mkdir(path.join(tmp, '.projscan-plugins'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, '.projscan-plugins', 'policy.projscan-plugin.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'policy',
      kind: 'analyzer',
      module: './policy.mjs',
      category: 'custom',
    }),
  );
  await fs.writeFile(
    path.join(tmp, '.projscan-plugins', 'policy.mjs'),
    `export default {
      check: async () => [{
        id: 'blocked-pattern',
        title: 'Blocked pattern',
        description: 'Fixture plugin issue.',
        severity: 'error',
        category: '',
        fixAvailable: false,
        locations: [{ file: 'src/a.ts', line: 1 }],
      }],
    };`,
  );
});

afterEach(async () => {
  if (originalFlag === undefined) delete process.env.PROJSCAN_PLUGINS_PREVIEW;
  else process.env.PROJSCAN_PLUGINS_PREVIEW = originalFlag;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function collectFixtureIssues() {
  const scan = await scanRepository(tmp);
  return collectIssues(tmp, scan.files);
}

describe('plugin analyzer pipeline', () => {
  it('does not run plugins when preview flag is disabled', async () => {
    delete process.env.PROJSCAN_PLUGINS_PREVIEW;
    const issues = await collectFixtureIssues();
    expect(issues.find((i) => i.id === 'plugin:policy:blocked-pattern')).toBeUndefined();
  });

  it('merges enabled plugin issues into collectIssues', async () => {
    process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
    const issues = await collectFixtureIssues();
    const pluginIssue = issues.find((i) => i.id === 'plugin:policy:blocked-pattern');
    expect(pluginIssue).toMatchObject({
      title: 'Blocked pattern',
      severity: 'error',
      category: 'custom',
      locations: [{ file: 'src/a.ts', line: 1 }],
    });
  });

  it('plugin errors affect the same score used by doctor and ci', async () => {
    process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
    const issues = await collectFixtureIssues();
    const score = calculateScore(issues);
    expect(score.errors).toBeGreaterThanOrEqual(1);
    expect(score.score).toBeLessThan(100);
  });
});
```

- [ ] **Step 2: Run the pipeline test**

Run:

```sh
npm test -- tests/core/pluginPipeline.test.ts
```

Expected: PASS if current pipeline already works. If it fails because plugin output shape is stricter than the fixture, fix the fixture instead of relaxing production checks.

- [ ] **Step 3: Add MCP doctor/analyze proof if pipeline test passes too narrowly**

If Task 5 Step 2 passes without exercising MCP code, extend `tests/mcp/plugin.test.ts` with:

```ts
  it('enabled plugin issues appear in MCP doctor and analyze output', async () => {
    process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
    await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'src', 'a.ts'), 'export const a = 1;\n');
    await fs.writeFile(
      path.join(tmp, '.projscan-plugins', 'policy.projscan-plugin.json'),
      JSON.stringify({
        schemaVersion: 1,
        name: 'policy',
        kind: 'analyzer',
        module: './policy.mjs',
        category: 'custom',
      }),
    );
    await fs.writeFile(
      path.join(tmp, '.projscan-plugins', 'policy.mjs'),
      `export default {
        check: async () => [{
          id: 'mcp-rule',
          title: 'MCP plugin rule',
          description: 'Visible through MCP.',
          severity: 'warning',
          category: 'custom',
          fixAvailable: false,
          locations: [{ file: 'src/a.ts', line: 1 }],
        }],
      };`,
    );
    const server = createMcpServer(tmp);
    await init(server);
    const doctor = await call(server, 'projscan_doctor', {});
    const doctorIssues = doctor.issues as Array<{ id: string }>;
    expect(doctorIssues.some((i) => i.id === 'plugin:policy:mcp-rule')).toBe(true);
    const analyze = await call(server, 'projscan_analyze', {});
    const analyzeIssues = analyze.issues as Array<{ id: string }>;
    expect(analyzeIssues.some((i) => i.id === 'plugin:policy:mcp-rule')).toBe(true);
    server.close();
  });
```

Run:

```sh
npm test -- tests/mcp/plugin.test.ts
```

Expected: PASS.

## Task 6: Plugin Authoring Documentation

**Files:**
- Create: `docs/PLUGIN-AUTHORING.md`
- Modify: `README.md`
- Modify: `docs/GUIDE.md`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Create the plugin authoring guide**

Create `docs/PLUGIN-AUTHORING.md` with this content:

````md
# Plugin Authoring

projscan 1.10 introduced an analyzer plugin preview. The preview is gated by
`PROJSCAN_PLUGINS_PREVIEW=1` while the 2.0 contract is being finalized.

Plugins are local code. Enabling the preview means you trust the plugin code in
the repository, the same way you trust project scripts in `package.json`.
projscan does not fetch remote plugin code.

## Layout

Plugin manifests live under `.projscan-plugins/`:

```text
.projscan-plugins/
  policy.projscan-plugin.json
  policy.mjs
```

## Manifest

```json
{
  "schemaVersion": 1,
  "name": "policy",
  "kind": "analyzer",
  "module": "./policy.mjs",
  "category": "custom",
  "description": "Project-specific policy checks"
}
```

Fields:

- `schemaVersion`: must be `1`.
- `name`: stable plugin identifier. Issue ids are prefixed with `plugin:<name>:`.
- `kind`: currently only `analyzer`.
- `module`: relative path inside the plugin directory. Absolute paths and `..` are rejected.
- `category`: fallback issue category when a plugin issue omits one.
- `description`: optional summary for humans and agents.

## Analyzer Module

The module must export a `check(rootPath, files)` function, either as the
default export or a named export.

```js
export default {
  check: async (rootPath, files) => {
    return files
      .filter((file) => file.relativePath.endsWith('.ts'))
      .filter((file) => file.relativePath.includes('legacy'))
      .map((file) => ({
        id: 'legacy-typescript-file',
        title: 'Legacy TypeScript file',
        description: `${file.relativePath} is under the legacy tree.`,
        severity: 'warning',
        category: 'custom',
        fixAvailable: false,
        locations: [{ file: file.relativePath, line: 1 }],
      }));
  },
};
```

Required issue fields:

- `id`
- `title`
- `description`
- `severity`: `error`, `warning`, or `info`
- `category`
- `fixAvailable`

Malformed issues are dropped so one bad plugin cannot poison the issue stream.

## Validate

```sh
projscan plugin validate .projscan-plugins/policy.projscan-plugin.json
projscan plugin validate .projscan-plugins/policy.projscan-plugin.json --format json
```

Validation reports structured diagnostics with a stable `code`, the manifest
`field` when applicable, a `message`, and sometimes a `hint`.

## List

```sh
projscan plugin list
projscan plugin list --format json
```

The list command discovers manifests whether or not execution is enabled. It
shows `enabled:false` until the preview flag is set.

## Enable

```sh
PROJSCAN_PLUGINS_PREVIEW=1 projscan doctor
PROJSCAN_PLUGINS_PREVIEW=1 projscan ci
PROJSCAN_PLUGINS_PREVIEW=1 projscan analyze
```

When enabled, analyzer plugin issues are merged into the same issue stream as
built-in analyzer issues. That means they affect health scores and CI gates in
the same way.

## MCP

The `projscan_plugin` MCP tool supports:

- `action: "list"`
- `action: "validate"` with `manifest_path`

Plugin execution for MCP `projscan_doctor` and `projscan_analyze` follows the
same `PROJSCAN_PLUGINS_PREVIEW` flag as the CLI.

## Failure Isolation

- One plugin failing to load does not stop other plugins.
- One plugin throwing during `check` does not stop built-in analyzers.
- Malformed issues are dropped.
- Runtime plugin warnings go to stderr so JSON stdout stays parseable.

## Compatibility

This is a preview for the 2.0 plugin contract. The current shape is the intended
direction, but plugin authors should expect final polish before 2.0 removes the
preview label.
````

- [ ] **Step 2: Link from README**

In `README.md`, find the plugin API preview mention in the MCP tools section and add this sentence nearby:

```md
For plugin authoring, manifest validation, and the trust model, see [Plugin Authoring](docs/PLUGIN-AUTHORING.md).
```

- [ ] **Step 3: Link from guide**

In `docs/GUIDE.md`, add this sentence near the MCP plugin tool documentation or the architecture file map:

```md
For the analyzer plugin preview, including a minimal manifest and analyzer module, see [Plugin Authoring](PLUGIN-AUTHORING.md).
```

- [ ] **Step 4: Link from roadmap**

In `docs/ROADMAP.md`, under the 2.0 plugin API bullet, add:

```md
  The current preview contract and authoring flow are documented in [Plugin Authoring](PLUGIN-AUTHORING.md).
```

- [ ] **Step 5: Run docs-relevant smoke checks**

Run:

```sh
rg -n "PLUGIN-AUTHORING|Plugin Authoring|projscan plugin validate" README.md docs/PLUGIN-AUTHORING.md docs/GUIDE.md docs/ROADMAP.md
```

Expected: the new guide and all three links are present.

## Task 7: Stability and Release Guardrails

**Files:**
- Modify only if needed: `docs/superpowers/specs/2026-05-18-plugin-platform-hardening-design.md`
- Modify only if needed: `docs/superpowers/plans/2026-05-18-plugin-platform-hardening.md`

- [ ] **Step 1: Confirm no release files changed**

Run:

```sh
git diff -- package.json package-lock.json .github/mcp-registry/server.json CHANGELOG.md .github/workflows/release.yml
```

Expected: no diff. If any diff appears, revert only the accidental release-prep edits from this branch and keep unrelated user changes intact.

- [ ] **Step 2: Confirm stable public surface additions only**

Run:

```sh
npm run build
npm run check:stability
```

Expected: build succeeds and stability check passes. Structured diagnostics in plugin tooling must not remove existing tool names, CLI commands, output keys, or required arguments.

- [ ] **Step 3: Confirm projscan health**

Run:

```sh
node ./dist/cli/index.js doctor --format json --quiet
```

Expected: score remains `100`, grade `A`, and issues remain empty. If plugin docs or tests introduce a signal, fix the underlying issue before considering the work complete.

## Task 8: Full Verification

**Files:**
- No new files expected unless earlier verification reveals a defect.

- [ ] **Step 1: Run all unit and integration tests**

Run:

```sh
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run lint**

Run:

```sh
npm run lint
```

Expected: no lint errors.

- [ ] **Step 3: Run build**

Run:

```sh
npm run build
```

Expected: TypeScript compilation, wasm copy, and tool manifest generation succeed.

- [ ] **Step 4: Run stability check**

Run:

```sh
npm run check:stability
```

Expected: pass without requiring baseline updates.

- [ ] **Step 5: Run local plugin CLI smoke**

Create a temporary fixture outside the repo:

```sh
tmpdir="$(mktemp -d)"
mkdir -p "$tmpdir/.projscan-plugins" "$tmpdir/src"
printf '{"name":"fixture","version":"0.0.0"}\n' > "$tmpdir/package.json"
printf 'export const a = 1;\n' > "$tmpdir/src/a.ts"
printf '{"schemaVersion":1,"name":"policy","kind":"analyzer","module":"./policy.mjs","category":"custom"}\n' > "$tmpdir/.projscan-plugins/policy.projscan-plugin.json"
cat > "$tmpdir/.projscan-plugins/policy.mjs" <<'EOF'
export default {
  check: async () => [{
    id: 'smoke',
    title: 'Smoke plugin issue',
    description: 'Plugin smoke issue.',
    severity: 'warning',
    category: 'custom',
    fixAvailable: false,
    locations: [{ file: 'src/a.ts', line: 1 }],
  }],
};
EOF
```

Run from the repo:

```sh
node ./dist/cli/index.js plugin validate "$tmpdir/.projscan-plugins/policy.projscan-plugin.json" --format json
PROJSCAN_PLUGINS_PREVIEW=1 node ./dist/cli/index.js doctor --format json --quiet --config "$tmpdir/.projscanrc.json"
```

If `--config` cannot switch roots because the CLI root is current-working-directory based, run the doctor smoke from inside the fixture:

```sh
cd "$tmpdir"
PROJSCAN_PLUGINS_PREVIEW=1 node /Users/abhyoh/Documents/Brand/Apps/projscan/dist/cli/index.js doctor --format json --quiet
```

Expected: validation returns `{ "ok": true }`, and doctor output includes `plugin:policy:smoke`.

- [ ] **Step 6: Confirm git diff excludes release prep**

Run:

```sh
git status --short
git diff --stat
git diff -- package.json package-lock.json .github/mcp-registry/server.json CHANGELOG.md
```

Expected: source, tests, and docs only; no version bump; no changelog release entry unless the user explicitly asked for release prep.

## Execution Notes

- Before implementation, use `superpowers:using-git-worktrees` or consciously work in place if the user declines isolation. The current repo has an untracked `CLAUDE.md` from an earlier instruction update; do not include or revert it unless the user asks.
- Do not push, tag, bump, publish, or alter npm release state.
- If network-dependent commands fail because of sandboxing, request escalation instead of bypassing the command.
