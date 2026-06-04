import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  PLUGIN_DIR,
  PLUGIN_PREVIEW_FLAG,
  loadPlugins,
  resolveReporterPlugin,
} from '../../src/core/plugins.js';
import { PLUGIN_TRUST_HOME_ENV, trustPlugin } from '../../src/core/pluginTrust.js';

let repo: string;
let trustHome: string;
let originalFlag: string | undefined;
let originalHome: string | undefined;

beforeEach(async () => {
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-trustgate-'));
  trustHome = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-trustgate-home-'));
  originalFlag = process.env[PLUGIN_PREVIEW_FLAG];
  originalHome = process.env[PLUGIN_TRUST_HOME_ENV];
  process.env[PLUGIN_PREVIEW_FLAG] = '1';
  process.env[PLUGIN_TRUST_HOME_ENV] = trustHome;
});

afterEach(async () => {
  if (originalFlag === undefined) delete process.env[PLUGIN_PREVIEW_FLAG];
  else process.env[PLUGIN_PREVIEW_FLAG] = originalFlag;
  if (originalHome === undefined) delete process.env[PLUGIN_TRUST_HOME_ENV];
  else process.env[PLUGIN_TRUST_HOME_ENV] = originalHome;
  await fs.rm(repo, { recursive: true, force: true });
  await fs.rm(trustHome, { recursive: true, force: true });
});

async function writeAnalyzer(name: string, moduleRel: string, source: string): Promise<string> {
  const dir = path.join(repo, PLUGIN_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${name}.projscan-plugin.json`),
    JSON.stringify({ schemaVersion: 1, name, kind: 'analyzer', module: moduleRel, category: 'custom' }),
    'utf-8',
  );
  const modulePath = path.join(dir, moduleRel);
  await fs.writeFile(modulePath, source, 'utf-8');
  return modulePath;
}

async function writeReporter(name: string, moduleRel: string, source: string): Promise<string> {
  const dir = path.join(repo, PLUGIN_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${name}.projscan-plugin.json`),
    JSON.stringify({ schemaVersion: 1, name, kind: 'reporter', module: moduleRel, commands: ['doctor'] }),
    'utf-8',
  );
  const modulePath = path.join(dir, moduleRel);
  await fs.writeFile(modulePath, source, 'utf-8');
  return modulePath;
}

async function captureStderr(fn: () => Promise<unknown>): Promise<string> {
  const original = process.stderr.write.bind(process.stderr);
  let output = '';
  process.stderr.write = ((chunk: unknown) => {
    output += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  try {
    await fn();
  } finally {
    process.stderr.write = original;
  }
  return output;
}

const ANALYZER_SRC = `export default { check: async () => [] };`;
// Same valid shape, different bytes — stands in for an attacker swapping the
// module contents after the user approved the original.
const SWAPPED_SRC = `export default { check: async () => [{ id: 'x', title: 't', description: 'd', severity: 'info', category: 'c', fixAvailable: false }] };`;
const REPORTER_SRC = `export default { render: () => 'ok' };`;

describe('plugin trust gate — analyzers', () => {
  it('does NOT load an untrusted analyzer plugin, and warns how to approve it', async () => {
    await writeAnalyzer('evil', './evil.mjs', ANALYZER_SRC);
    let loaded;
    const stderr = await captureStderr(async () => {
      loaded = await loadPlugins(repo);
    });
    expect(loaded).toEqual([]);
    expect(stderr).toContain('not trusted');
    expect(stderr).toContain('projscan plugin trust evil');
  });

  it('loads the analyzer once its exact bytes are trusted', async () => {
    const modulePath = await writeAnalyzer('ok', './ok.mjs', ANALYZER_SRC);
    await trustPlugin(modulePath, 'ok');
    const loaded = await loadPlugins(repo);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].manifest.name).toBe('ok');
  });

  it('refuses to load a trusted analyzer whose module changed after approval', async () => {
    const modulePath = await writeAnalyzer('drift', './drift.mjs', ANALYZER_SRC);
    await trustPlugin(modulePath, 'drift');
    // Attacker swaps the bytes after the user approved the original.
    await fs.writeFile(modulePath, SWAPPED_SRC, 'utf-8');
    let loaded;
    const stderr = await captureStderr(async () => {
      loaded = await loadPlugins(repo);
    });
    expect(loaded).toEqual([]);
    expect(stderr).toContain('changed');
  });
});

describe('plugin trust gate — reporters', () => {
  it('refuses an untrusted reporter plugin with a plugin-untrusted diagnostic', async () => {
    await writeReporter('summary', './summary.mjs', REPORTER_SRC);
    const result = await resolveReporterPlugin(repo, 'summary', 'doctor');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostic.code).toBe('plugin-untrusted');
      expect(result.diagnostic.hint).toContain('projscan plugin trust summary');
    }
  });

  it('resolves the reporter once trusted', async () => {
    const modulePath = await writeReporter('summary', './summary.mjs', REPORTER_SRC);
    await trustPlugin(modulePath, 'summary');
    const result = await resolveReporterPlugin(repo, 'summary', 'doctor');
    expect(result.ok).toBe(true);
  });
});
