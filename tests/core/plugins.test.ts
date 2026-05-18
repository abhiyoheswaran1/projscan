import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  PLUGIN_DIR,
  PLUGIN_PREVIEW_FLAG,
  discoverPluginManifests,
  loadPlugins,
  pluginsEnabled,
  readPluginManifestFile,
  renderReporterPlugin,
  resolveReporterPlugin,
  runAnalyzerPlugins,
  validateManifest,
} from '../../src/core/plugins.js';

let tmp: string;
let originalFlag: string | undefined;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-plugins-'));
  originalFlag = process.env[PLUGIN_PREVIEW_FLAG];
});

afterEach(async () => {
  if (originalFlag === undefined) delete process.env[PLUGIN_PREVIEW_FLAG];
  else process.env[PLUGIN_PREVIEW_FLAG] = originalFlag;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function writeManifest(name: string, body: unknown): Promise<string> {
  const dir = path.join(tmp, PLUGIN_DIR);
  await fs.mkdir(dir, { recursive: true });
  const p = path.join(dir, `${name}.projscan-plugin.json`);
  await fs.writeFile(p, JSON.stringify(body), 'utf-8');
  return p;
}

async function writeModule(rel: string, source: string): Promise<void> {
  const dir = path.join(tmp, PLUGIN_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, rel), source, 'utf-8');
}

describe('plugins — validateManifest', () => {
  it('accepts a minimal well-formed manifest', () => {
    const v = validateManifest({
      schemaVersion: 1,
      name: 'my-plugin',
      kind: 'analyzer',
      module: './check.mjs',
      category: 'custom',
    });
    expect(v.ok).toBe(true);
  });

  it('rejects wrong schemaVersion', () => {
    const v = validateManifest({
      schemaVersion: 2,
      name: 'p',
      kind: 'analyzer',
      module: './c.mjs',
      category: 'x',
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/schemaVersion/);
  });

  it('rejects path-traversal in module field (security)', () => {
    const v = validateManifest({
      schemaVersion: 1,
      name: 'p',
      kind: 'analyzer',
      module: '../../../etc/passwd',
      category: 'x',
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/relative path inside/);
  });

  it('rejects absolute module path (security)', () => {
    const v = validateManifest({
      schemaVersion: 1,
      name: 'p',
      kind: 'analyzer',
      module: '/etc/passwd',
      category: 'x',
    });
    expect(v.ok).toBe(false);
  });

  it('accepts a reporter manifest with supported commands', () => {
    const v = validateManifest({
      schemaVersion: 1,
      name: 'team-summary',
      kind: 'reporter',
      module: './summary.mjs',
      commands: ['doctor', 'analyze', 'ci'],
      description: 'Team summary reporter',
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.manifest).toMatchObject({
        name: 'team-summary',
        kind: 'reporter',
        module: './summary.mjs',
        commands: ['doctor', 'analyze', 'ci'],
      });
      expect('category' in v.manifest).toBe(false);
    }
  });

  it('rejects reporter manifests without a non-empty commands array', () => {
    const v = validateManifest({
      schemaVersion: 1,
      name: 'team-summary',
      kind: 'reporter',
      module: './summary.mjs',
      commands: [],
    });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.diagnostic).toMatchObject({
        code: 'invalid-commands',
        field: 'commands',
      });
      expect(v.reason).toMatch(/commands/);
    }
  });

  it('rejects reporter manifests with unsupported commands', () => {
    const v = validateManifest({
      schemaVersion: 1,
      name: 'team-summary',
      kind: 'reporter',
      module: './summary.mjs',
      commands: ['doctor', 'hotspots'],
    });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.diagnostic).toMatchObject({
        code: 'invalid-commands',
        field: 'commands',
      });
      expect(v.diagnostic.message).toContain('hotspots');
    }
  });

  it('keeps category required for analyzer manifests', () => {
    const v = validateManifest({
      schemaVersion: 1,
      name: 'p',
      kind: 'analyzer',
      module: './c.mjs',
    });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.diagnostic).toMatchObject({
        code: 'invalid-category',
        field: 'category',
      });
    }
  });

  it('rejects unsupported kind', () => {
    const v = validateManifest({
      schemaVersion: 1,
      name: 'p',
      kind: 'renderer',
      module: './c.mjs',
      category: 'x',
    });
    expect(v.ok).toBe(false);
  });

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
});

describe('plugins — discoverPluginManifests', () => {
  it('returns [] when .projscan-plugins/ does not exist', async () => {
    const entries = await discoverPluginManifests(tmp);
    expect(entries).toEqual([]);
  });

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

  it('discovers a valid manifest', async () => {
    await writeManifest('a', {
      schemaVersion: 1,
      name: 'a',
      kind: 'analyzer',
      module: './a.mjs',
      category: 'custom',
    });
    const entries = await discoverPluginManifests(tmp);
    expect(entries).toHaveLength(1);
    expect(entries[0].manifest?.name).toBe('a');
  });
});

describe('plugins — readPluginManifestFile', () => {
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

describe('plugins — loadPlugins', () => {
  it('returns [] when the preview flag is off', async () => {
    delete process.env[PLUGIN_PREVIEW_FLAG];
    expect(pluginsEnabled()).toBe(false);
    await writeManifest('a', {
      schemaVersion: 1,
      name: 'a',
      kind: 'analyzer',
      module: './a.mjs',
      category: 'custom',
    });
    await writeModule('a.mjs', `export default { check: async () => [] }`);
    const loaded = await loadPlugins(tmp);
    expect(loaded).toEqual([]);
  });

  it('loads a plugin and runs it through runAnalyzerPlugins', async () => {
    process.env[PLUGIN_PREVIEW_FLAG] = '1';
    expect(pluginsEnabled()).toBe(true);
    await writeManifest('counter', {
      schemaVersion: 1,
      name: 'counter',
      kind: 'analyzer',
      module: './counter.mjs',
      category: 'custom',
      description: 'counts files',
    });
    await writeModule(
      'counter.mjs',
      `export default {
        check: async (rootPath, files) => [
          {
            id: 'count',
            title: 'file count',
            description: \`saw \${files.length} files\`,
            severity: 'info',
            category: '',
            fixAvailable: false,
          },
        ],
      };`,
    );
    const loaded = await loadPlugins(tmp);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].manifest.name).toBe('counter');

    const issues = await runAnalyzerPlugins(loaded, tmp, [
      { relativePath: 'a.ts', absolutePath: '/x/a.ts', directory: '.', extension: '.ts', sizeBytes: 0 },
    ]);
    expect(issues).toHaveLength(1);
    // 1.10+ — issue id is prefixed with `plugin:<name>:` so two plugins
    // emitting the same local rule id can't collide.
    expect(issues[0].id).toBe('plugin:counter:count');
    // 1.10+ — empty category falls back to the manifest's declared category.
    expect(issues[0].category).toBe('custom');
  });

  it('drops malformed Issues from plugin output without crashing', async () => {
    process.env[PLUGIN_PREVIEW_FLAG] = '1';
    await writeManifest('bad', {
      schemaVersion: 1,
      name: 'bad',
      kind: 'analyzer',
      module: './bad.mjs',
      category: 'custom',
    });
    await writeModule(
      'bad.mjs',
      `export default {
        check: async () => [
          { id: 'ok', title: 't', description: 'd', severity: 'warning', category: 'c', fixAvailable: false },
          { id: 'no-severity', title: 't', description: 'd', category: 'c', fixAvailable: false },
          null,
          'a string',
        ],
      };`,
    );
    const loaded = await loadPlugins(tmp);
    const issues = await runAnalyzerPlugins(loaded, tmp, []);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('plugin:bad:ok');
  });

  it('isolates one plugin crashing from the rest', async () => {
    process.env[PLUGIN_PREVIEW_FLAG] = '1';
    await writeManifest('boom', {
      schemaVersion: 1,
      name: 'boom',
      kind: 'analyzer',
      module: './boom.mjs',
      category: 'custom',
    });
    await writeModule('boom.mjs', `export default { check: async () => { throw new Error('kaboom'); } }`);
    await writeManifest('fine', {
      schemaVersion: 1,
      name: 'fine',
      kind: 'analyzer',
      module: './fine.mjs',
      category: 'custom',
    });
    await writeModule(
      'fine.mjs',
      `export default {
        check: async () => [
          { id: 'r', title: 't', description: 'd', severity: 'info', category: 'c', fixAvailable: false },
        ],
      };`,
    );
    const loaded = await loadPlugins(tmp);
    expect(loaded).toHaveLength(2);
    // Silence the stderr write the crash logs.
    const origStderr = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((..._args: unknown[]) => true) as typeof process.stderr.write;
    try {
      const issues = await runAnalyzerPlugins(loaded, tmp, []);
      expect(issues.map((i) => i.id)).toEqual(['plugin:fine:r']);
    } finally {
      process.stderr.write = origStderr;
    }
  });
});

describe('plugins — reporter runtime', () => {
  it('does not resolve reporter plugins when the preview flag is off', async () => {
    delete process.env[PLUGIN_PREVIEW_FLAG];
    await writeManifest('summary', {
      schemaVersion: 1,
      name: 'summary',
      kind: 'reporter',
      module: './summary.mjs',
      commands: ['doctor'],
    });
    await writeModule('summary.mjs', `export default { render: async () => 'unused' }`);

    const result = await resolveReporterPlugin(tmp, 'summary', 'doctor');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostic).toMatchObject({
        code: 'plugins-disabled',
      });
      expect(result.reason).toContain(PLUGIN_PREVIEW_FLAG);
    }
  });

  it('resolves a reporter plugin by name and command', async () => {
    process.env[PLUGIN_PREVIEW_FLAG] = '1';
    await writeManifest('summary', {
      schemaVersion: 1,
      name: 'summary',
      kind: 'reporter',
      module: './summary.mjs',
      commands: ['doctor', 'ci'],
      description: 'summary output',
    });
    await writeModule(
      'summary.mjs',
      `export default {
        render: async (context) => \`\${context.command}:\${context.payload.health.score}:\${context.manifest.name}\`,
      };`,
    );

    const resolved = await resolveReporterPlugin(tmp, 'summary', 'doctor');
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error(resolved.reason);
    expect(resolved.plugin.manifest.commands).toEqual(['doctor', 'ci']);

    const rendered = await renderReporterPlugin(resolved.plugin, {
      command: 'doctor',
      rootPath: tmp,
      manifest: resolved.plugin.manifest,
      payload: { health: { score: 88 } },
    });
    expect(rendered).toEqual({ ok: true, output: 'doctor:88:summary' });
  });

  it('rejects a reporter that does not support the requested command', async () => {
    process.env[PLUGIN_PREVIEW_FLAG] = '1';
    await writeManifest('summary', {
      schemaVersion: 1,
      name: 'summary',
      kind: 'reporter',
      module: './summary.mjs',
      commands: ['doctor'],
    });
    await writeModule('summary.mjs', `export default { render: async () => 'unused' }`);

    const result = await resolveReporterPlugin(tmp, 'summary', 'ci');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostic).toMatchObject({
        code: 'reporter-unsupported-command',
      });
      expect(result.reason).toContain('ci');
    }
  });

  it('returns a diagnostic when a reporter has no render export', async () => {
    process.env[PLUGIN_PREVIEW_FLAG] = '1';
    await writeManifest('summary', {
      schemaVersion: 1,
      name: 'summary',
      kind: 'reporter',
      module: './summary.mjs',
      commands: ['doctor'],
    });
    await writeModule('summary.mjs', `export default { check: async () => [] }`);

    const result = await resolveReporterPlugin(tmp, 'summary', 'doctor');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostic).toMatchObject({
        code: 'invalid-reporter-export',
      });
      expect(result.reason).toContain('render');
    }
  });

  it('isolates reporter render throws and non-string output', async () => {
    process.env[PLUGIN_PREVIEW_FLAG] = '1';
    await writeManifest('thrower', {
      schemaVersion: 1,
      name: 'thrower',
      kind: 'reporter',
      module: './thrower.mjs',
      commands: ['doctor'],
    });
    await writeModule('thrower.mjs', `export default { render: async () => { throw new Error('boom'); } }`);
    const thrower = await resolveReporterPlugin(tmp, 'thrower', 'doctor');
    expect(thrower.ok).toBe(true);
    if (!thrower.ok) throw new Error(thrower.reason);
    const thrown = await renderReporterPlugin(thrower.plugin, {
      command: 'doctor',
      rootPath: tmp,
      manifest: thrower.plugin.manifest,
      payload: {},
    });
    expect(thrown.ok).toBe(false);
    if (!thrown.ok) {
      expect(thrown.diagnostic).toMatchObject({ code: 'reporter-render-error' });
      expect(thrown.reason).toContain('boom');
    }

    await writeManifest('objecter', {
      schemaVersion: 1,
      name: 'objecter',
      kind: 'reporter',
      module: './objecter.mjs',
      commands: ['doctor'],
    });
    await writeModule('objecter.mjs', `export default { render: async () => ({ text: 'nope' }) }`);
    const objecter = await resolveReporterPlugin(tmp, 'objecter', 'doctor');
    expect(objecter.ok).toBe(true);
    if (!objecter.ok) throw new Error(objecter.reason);
    const objectOutput = await renderReporterPlugin(objecter.plugin, {
      command: 'doctor',
      rootPath: tmp,
      manifest: objecter.plugin.manifest,
      payload: {},
    });
    expect(objectOutput.ok).toBe(false);
    if (!objectOutput.ok) {
      expect(objectOutput.diagnostic).toMatchObject({ code: 'reporter-render-error' });
      expect(objectOutput.reason).toContain('string');
    }
  });
});
