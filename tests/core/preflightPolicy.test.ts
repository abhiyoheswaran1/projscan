import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { computePreflight } from '../../src/core/preflight.js';
import { PLUGIN_TRUST_HOME_ENV, trustPlugin } from '../../src/core/pluginTrust.js';

const tempRoots: string[] = [];
let originalPluginFlag: string | undefined;
let originalTrustHome: string | undefined;
let trustHome: string;

beforeEach(async () => {
  originalPluginFlag = process.env.PROJSCAN_PLUGINS_PREVIEW;
  originalTrustHome = process.env[PLUGIN_TRUST_HOME_ENV];
  delete process.env.PROJSCAN_PLUGINS_PREVIEW;
  trustHome = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-preflight-trust-'));
  process.env[PLUGIN_TRUST_HOME_ENV] = trustHome;
});

afterEach(async () => {
  if (originalPluginFlag === undefined) delete process.env.PROJSCAN_PLUGINS_PREVIEW;
  else process.env.PROJSCAN_PLUGINS_PREVIEW = originalPluginFlag;
  if (originalTrustHome === undefined) delete process.env[PLUGIN_TRUST_HOME_ENV];
  else process.env[PLUGIN_TRUST_HOME_ENV] = originalTrustHome;
  await fs.rm(trustHome, { recursive: true, force: true });
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('plugin policy errors block preflight when preview execution is already trusted', async () => {
  process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
  const root = await makeTempProject();
  await writeErrorPlugin(root);
  // Trust-on-first-use: the plugin only executes once its bytes are approved.
  await trustPlugin(path.join(root, '.projscan-plugins', 'policy.mjs'), 'policy');

  const report = await computePreflight(root, { mode: 'before_edit', enablePlugins: true });

  expect(report.verdict).toBe('block');
  expect(report.evidence.plugins).toEqual(
    expect.objectContaining({ enabled: true, errorIssues: 1 }),
  );
  expect(
    report.reasons.some((reason) => reason.source === 'plugin' && reason.severity === 'error'),
  ).toBe(true);
});

test('preflight enablePlugins option does not enable local plugin code without preview flag', async () => {
  const root = await makeTempProject();
  const markerPath = path.join(root, 'plugin-executed.txt');
  await writeMarkerPlugin(root, markerPath);

  const report = await computePreflight(root, { mode: 'before_edit', enablePlugins: true });

  expect(report.verdict).not.toBe('block');
  expect(report.evidence.plugins).toEqual(expect.objectContaining({ enabled: false }));
  expect(report.reasons.some((reason) => reason.source === 'plugin')).toBe(false);
  await expect(fs.access(markerPath)).rejects.toThrow();
});

test('known compromised package versions block preflight', async () => {
  const root = await makeTempProject();
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
    dependencies: {
      '@tanstack/react-router': '1.169.5',
    },
  });

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.verdict).toBe('block');
  expect(report.evidence.supplyChain).toEqual(
    expect.objectContaining({ errorIssues: 1, warningIssues: 0 }),
  );
  expect(report.reasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'supply-chain',
        severity: 'error',
        issueId: 'supply-chain-malicious-package-@tanstack/react-router',
      }),
    ]),
  );
});

test('hidden editor persistence hooks block preflight', async () => {
  const root = await makeTempProject();
  await fs.mkdir(path.join(root, '.vscode'), { recursive: true });
  await writeJson(path.join(root, '.vscode', 'tasks.json'), {
    version: '2.0.0',
    tasks: [
      {
        label: 'monitor',
        type: 'shell',
        command: 'gh-token-monitor --watch && rm -rf ~',
      },
    ],
  });

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.verdict).toBe('block');
  expect(report.reasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'supply-chain',
        severity: 'error',
        issueId: 'supply-chain-hidden-persistence-hook',
        file: '.vscode/tasks.json',
      }),
    ]),
  );
});

test('risky git dependencies and lifecycle scripts caution preflight', async () => {
  const root = await makeTempProject();
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
    optionalDependencies: {
      'team-policy': 'github:example/team-policy#2e5f6c7d8a9b0c1d2e3f4a5b6c7d8e9f00112233',
    },
    scripts: {
      postinstall: 'node ./scripts/setup.js',
    },
  });

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.verdict).toBe('caution');
  expect(report.evidence.supplyChain).toEqual(
    expect.objectContaining({ errorIssues: 0, warningIssues: 2 }),
  );
  expect(report.reasons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        source: 'supply-chain',
        severity: 'warning',
        issueId: 'supply-chain-git-dependency-team-policy',
      }),
      expect.objectContaining({
        source: 'supply-chain',
        severity: 'warning',
        issueId: 'supply-chain-lifecycle-postinstall',
      }),
    ]),
  );
});

test('expected build prepare scripts do not caution preflight', async () => {
  const root = await makeTempProject();
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
    scripts: {
      build: 'tsc',
      prepare: 'npm run build',
    },
  });

  const report = await computePreflight(root, { mode: 'before_edit' });

  expect(report.reasons.some((reason) => reason.issueId === 'supply-chain-lifecycle-prepare')).toBe(
    false,
  );
  expect(report.evidence.supplyChain).toEqual(
    expect.objectContaining({ errorIssues: 0, warningIssues: 0 }),
  );
});

async function makeTempProject(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-preflight-policy-'));
  tempRoots.push(root);
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.0',
    type: 'module',
  });
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeMarkerPlugin(root: string, markerPath: string): Promise<void> {
  const pluginDir = path.join(root, '.projscan-plugins');
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.writeFile(
    path.join(pluginDir, 'marker.projscan-plugin.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'marker',
      kind: 'analyzer',
      module: './marker.mjs',
      category: 'policy',
    }),
  );
  await fs.writeFile(
    path.join(pluginDir, 'marker.mjs'),
    `import { writeFile } from 'node:fs/promises';
await writeFile(${JSON.stringify(markerPath)}, 'executed');
export default {
  check: () => [{
    id: 'marker-policy',
    title: 'Marker policy',
    description: 'This should not execute unless the preview flag is already set.',
    severity: 'error',
    category: 'policy',
    fixAvailable: false,
  }],
};
`,
  );
}

async function writeErrorPlugin(root: string): Promise<void> {
  const pluginDir = path.join(root, '.projscan-plugins');
  await fs.mkdir(pluginDir, { recursive: true });
  await fs.writeFile(
    path.join(pluginDir, 'policy.projscan-plugin.json'),
    JSON.stringify({
      schemaVersion: 1,
      name: 'policy',
      kind: 'analyzer',
      module: './policy.mjs',
      category: 'policy',
    }),
  );
  await fs.writeFile(
    path.join(pluginDir, 'policy.mjs'),
    `export default {
      check: () => [{
        id: 'blocked-pattern',
        title: 'Blocked fixture policy',
        description: 'Fixture policy issue from analyzer plugin.',
        severity: 'error',
        category: 'policy',
        fixAvailable: false,
        locations: [{ file: 'src/index.ts', line: 1 }],
      }],
    };`,
  );
}
