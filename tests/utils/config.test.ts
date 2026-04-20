import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, applyConfigToIssues } from '../../src/utils/config.js';
import type { Issue } from '../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-config-'));
}

function issue(id: string, severity: Issue['severity'] = 'warning'): Issue {
  return {
    id,
    title: `issue ${id}`,
    description: 'desc',
    severity,
    category: 'test',
    fixAvailable: false,
  };
}

describe('loadConfig', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns empty config when no file exists', async () => {
    const result = await loadConfig(tmp);
    expect(result.config).toEqual({});
    expect(result.source).toBeNull();
  });

  it('loads .projscanrc.json', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscanrc.json'),
      JSON.stringify({ minScore: 80, disableRules: ['missing-prettier'] }),
    );
    const result = await loadConfig(tmp);
    expect(result.config.minScore).toBe(80);
    expect(result.config.disableRules).toEqual(['missing-prettier']);
    expect(result.source).toContain('.projscanrc.json');
  });

  it('loads from package.json "projscan" key when no .projscanrc exists', async () => {
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'x', projscan: { minScore: 90, ignore: ['**/fixtures/**'] } }),
    );
    const result = await loadConfig(tmp);
    expect(result.config.minScore).toBe(90);
    expect(result.config.ignore).toEqual(['**/fixtures/**']);
    expect(result.source).toContain('package.json');
  });

  it('clamps minScore to 0..100', async () => {
    await fs.writeFile(path.join(tmp, '.projscanrc.json'), JSON.stringify({ minScore: 250 }));
    const result = await loadConfig(tmp);
    expect(result.config.minScore).toBe(100);
  });

  it('normalizes hotspots options', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscanrc.json'),
      JSON.stringify({ hotspots: { limit: 15, since: '3 months ago' } }),
    );
    const result = await loadConfig(tmp);
    expect(result.config.hotspots?.limit).toBe(15);
    expect(result.config.hotspots?.since).toBe('3 months ago');
  });

  it('drops invalid severity overrides', async () => {
    await fs.writeFile(
      path.join(tmp, '.projscanrc.json'),
      JSON.stringify({
        severityOverrides: { 'missing-prettier': 'info', 'missing-readme': 'bogus' },
      }),
    );
    const result = await loadConfig(tmp);
    expect(result.config.severityOverrides).toEqual({ 'missing-prettier': 'info' });
  });

  it('throws with a helpful message on malformed JSON', async () => {
    await fs.writeFile(path.join(tmp, '.projscanrc.json'), '{ not valid }');
    await expect(loadConfig(tmp)).rejects.toThrow(/Invalid JSON/);
  });

  it('respects explicit config path', async () => {
    const custom = path.join(tmp, 'custom.json');
    await fs.writeFile(custom, JSON.stringify({ minScore: 55 }));
    const result = await loadConfig(tmp, custom);
    expect(result.config.minScore).toBe(55);
    expect(result.source).toBe(custom);
  });
});

describe('applyConfigToIssues', () => {
  it('drops issues matching disableRules exactly', () => {
    const issues = [issue('missing-prettier'), issue('missing-readme')];
    const out = applyConfigToIssues(issues, { disableRules: ['missing-prettier'] });
    expect(out.map((i) => i.id)).toEqual(['missing-readme']);
  });

  it('drops issues matching wildcard prefix in disableRules', () => {
    const issues = [issue('large-utils-dir'), issue('large-helpers-dir'), issue('missing-readme')];
    const out = applyConfigToIssues(issues, { disableRules: ['large-*'] });
    expect(out.map((i) => i.id)).toEqual(['missing-readme']);
  });

  it('remaps severity via severityOverrides', () => {
    const issues = [issue('missing-prettier', 'warning')];
    const out = applyConfigToIssues(issues, { severityOverrides: { 'missing-prettier': 'info' } });
    expect(out[0].severity).toBe('info');
  });

  it('leaves non-matching issues untouched', () => {
    const issues = [issue('missing-prettier', 'warning')];
    const out = applyConfigToIssues(issues, {});
    expect(out).toEqual(issues);
  });
});
