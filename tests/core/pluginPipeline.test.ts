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

  it('passes read-only graph context to analyzer plugins', async () => {
    process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
    await fs.writeFile(
      path.join(tmp, '.projscan-plugins', 'policy.mjs'),
      `export default {
        check: async (rootPath, files, context) => {
          const graph = await context.getSemanticGraph();
          return [{
            id: 'graph-metrics',
            title: 'Graph metrics',
            description: \`semantic graph has \${graph.metrics.totalFunctions} function(s)\`,
            severity: 'info',
            category: '',
            fixAvailable: false,
          }];
        },
      };`,
    );

    const issues = await collectFixtureIssues();

    expect(issues.find((i) => i.id === 'plugin:policy:graph-metrics')).toMatchObject({
      title: 'Graph metrics',
      category: 'custom',
      severity: 'info',
    });
  });

  it('plugin errors affect the same score used by doctor and ci', async () => {
    process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
    const issues = await collectFixtureIssues();
    const score = calculateScore(issues);
    expect(score.errors).toBeGreaterThanOrEqual(1);
    expect(score.score).toBeLessThan(100);
  });
  it('ships a graph-context example plugin that consumes semantic graph and dataflow', async () => {
    process.env.PROJSCAN_PLUGINS_PREVIEW = '1';
    const exampleDir = path.join(process.cwd(), 'docs', 'examples', 'plugins');
    const manifest = JSON.parse(
      await fs.readFile(path.join(exampleDir, 'graph-context.projscan-plugin.json'), 'utf-8'),
    );
    expect(manifest).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        name: 'graph-context',
        kind: 'analyzer',
        module: './graph-context.mjs',
      }),
    );

    await fs.copyFile(
      path.join(exampleDir, 'graph-context.projscan-plugin.json'),
      path.join(tmp, '.projscan-plugins', 'graph-context.projscan-plugin.json'),
    );
    await fs.copyFile(
      path.join(exampleDir, 'graph-context.mjs'),
      path.join(tmp, '.projscan-plugins', 'graph-context.mjs'),
    );

    const issues = await collectFixtureIssues();

    expect(issues.find((i) => i.id === 'plugin:graph-context:graph-context-summary')).toMatchObject({
      title: 'Graph context available',
      category: 'architecture',
      severity: 'info',
    });
  });
});
