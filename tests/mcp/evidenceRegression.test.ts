import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-evidence-regression-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '2.2.0', type: 'module' }),
  );
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('lists evidence pack and regression plan MCP tools', () => {
  const names = getToolDefinitions().map((tool) => tool.name);

  expect(names).toEqual(expect.arrayContaining(['projscan_evidence_pack', 'projscan_regression_plan']));
});

test('projscan_evidence_pack returns approval evidence for the unreleased train', async () => {
  const handler = getToolHandler('projscan_evidence_pack');
  expect(handler).toBeDefined();

  const result = (await handler?.(
    { lines: ['2.3.x', '2.4.x', '2.5.x', '2.6.x'], website_prompt: true },
    tmp,
  )) as {
    evidencePack: { releaseMutation: boolean; train: { lines: string[] }; websitePrompt?: string };
  };

  expect(result.evidencePack.releaseMutation).toBe(false);
  expect(result.evidencePack.train.lines).toEqual(['2.3.x', '2.4.x', '2.5.x', '2.6.x']);
  expect(result.evidencePack.websitePrompt).toContain('projscan_evidence_pack');
});

test('projscan_regression_plan returns a risk-based command list', async () => {
  const handler = getToolHandler('projscan_regression_plan');
  expect(handler).toBeDefined();

  const result = (await handler?.({ level: 'full', max_targets: 5 }, tmp)) as {
    regressionPlan: { level: string; commands: string[]; targets: Array<{ verification: { commands: string[] } }> };
  };

  expect(result.regressionPlan.level).toBe('full');
  expect(result.regressionPlan.commands).toEqual(expect.arrayContaining(['npm test', 'npm run build']));
  expect(result.regressionPlan.targets.length).toBeGreaterThan(0);
});
