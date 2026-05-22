import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-brief-scorecard-'));
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

test('lists agent brief and quality scorecard MCP tools', () => {
  const names = getToolDefinitions().map((tool) => tool.name);

  expect(names).toEqual(expect.arrayContaining(['projscan_agent_brief', 'projscan_quality_scorecard']));
});

test('projscan_agent_brief returns focus and guardrails', async () => {
  const handler = getToolHandler('projscan_agent_brief');
  expect(handler).toBeDefined();

  const result = (await handler?.({ intent: 'release', max_items: 3 }, tmp)) as {
    agentBrief: { intent: string; focus: unknown[]; guardrails: unknown[] };
  };

  expect(result.agentBrief.intent).toBe('release');
  expect(result.agentBrief.focus.length).toBeGreaterThan(0);
  expect(result.agentBrief.guardrails.length).toBeGreaterThan(0);
});

test('projscan_quality_scorecard returns dimensions and commands', async () => {
  const handler = getToolHandler('projscan_quality_scorecard');
  expect(handler).toBeDefined();

  const result = (await handler?.({ max_risks: 4 }, tmp)) as {
    qualityScorecard: { dimensions: Array<{ id: string }>; commands: string[] };
  };

  expect(result.qualityScorecard.dimensions.map((dimension) => dimension.id)).toContain('health');
  expect(result.qualityScorecard.commands).toContain('projscan quality-scorecard --format json');
});
