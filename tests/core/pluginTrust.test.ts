import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  PLUGIN_TRUST_HOME_ENV,
  getPluginTrustStatus,
  trustPlugin,
  untrustPlugin,
  listTrustedPlugins,
} from '../../src/core/pluginTrust.js';

let trustHome: string;
let repo: string;
let modulePath: string;
let originalHome: string | undefined;

beforeEach(async () => {
  trustHome = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-trust-home-'));
  repo = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-trust-repo-'));
  modulePath = path.join(repo, 'check.mjs');
  await fs.writeFile(modulePath, 'export default { check: async () => [] };\n', 'utf-8');
  originalHome = process.env[PLUGIN_TRUST_HOME_ENV];
  process.env[PLUGIN_TRUST_HOME_ENV] = trustHome;
});

afterEach(async () => {
  if (originalHome === undefined) delete process.env[PLUGIN_TRUST_HOME_ENV];
  else process.env[PLUGIN_TRUST_HOME_ENV] = originalHome;
  await fs.rm(trustHome, { recursive: true, force: true });
  await fs.rm(repo, { recursive: true, force: true });
});

describe('pluginTrust', () => {
  it('reports an unknown module as untrusted with its current hash', async () => {
    const status = await getPluginTrustStatus(modulePath);
    expect(status.status).toBe('untrusted');
    expect(status.entry).toBeNull();
    expect(status.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reports a module as trusted after trustPlugin', async () => {
    await trustPlugin(modulePath, 'my-plugin');
    const status = await getPluginTrustStatus(modulePath);
    expect(status.status).toBe('trusted');
    expect(status.entry?.name).toBe('my-plugin');
  });

  it("reports a module whose content changed after trust as 'changed'", async () => {
    await trustPlugin(modulePath, 'my-plugin');
    await fs.writeFile(
      modulePath,
      'export default { check: async () => [{ id: "x" }] };\n',
      'utf-8',
    );
    const status = await getPluginTrustStatus(modulePath);
    expect(status.status).toBe('changed');
  });

  it('untrustPlugin removes trust (true once, false when nothing to remove)', async () => {
    await trustPlugin(modulePath, 'my-plugin');
    expect(await untrustPlugin(modulePath)).toBe(true);
    expect((await getPluginTrustStatus(modulePath)).status).toBe('untrusted');
    expect(await untrustPlugin(modulePath)).toBe(false);
  });

  it('lists trusted entries', async () => {
    await trustPlugin(modulePath, 'my-plugin');
    const entries = await listTrustedPlugins();
    expect(entries.map((e) => e.name)).toContain('my-plugin');
  });

  it('treats a missing module file as untrusted with a null hash', async () => {
    const status = await getPluginTrustStatus(path.join(repo, 'does-not-exist.mjs'));
    expect(status.status).toBe('untrusted');
    expect(status.sha256).toBeNull();
  });

  // Security: the trust store must live OUTSIDE the scanned repo. Otherwise a
  // malicious repo could ship a pre-populated trust file that auto-approves its
  // own plugin, defeating trust-on-first-use entirely.
  it('persists the trust store under the trust home, never inside the scanned repo', async () => {
    await trustPlugin(modulePath, 'my-plugin');
    const repoEntries = await fs.readdir(repo);
    expect(repoEntries).toEqual(['check.mjs']); // nothing new written into the repo
    const homeEntries = await fs.readdir(trustHome);
    expect(homeEntries).toContain('plugin-trust.json');
  });
});
