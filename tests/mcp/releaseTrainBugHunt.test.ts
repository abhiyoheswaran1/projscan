import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-train-hunt-'));
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

test('lists release train and bug hunt MCP tools', () => {
  const names = getToolDefinitions().map((tool) => tool.name);

  expect(names).toEqual(expect.arrayContaining(['projscan_release_train', 'projscan_bug_hunt']));
});

test('projscan_release_train returns a product readiness plan', async () => {
  const handler = getToolHandler('projscan_release_train');
  expect(handler).toBeDefined();

  const result = (await handler?.({ lines: ['2.3.x', '2.4.x'] }, tmp)) as {
    releaseTrain: { plan: { readOnly: boolean }; tracks: Array<{ line: string }> };
  };

  expect(result.releaseTrain.plan.readOnly).toBe(true);
  expect(result.releaseTrain.tracks.map((track) => track.line)).toEqual(['2.3.x', '2.4.x']);
});

test('projscan_bug_hunt returns a prioritized fix queue', async () => {
  const handler = getToolHandler('projscan_bug_hunt');
  expect(handler).toBeDefined();

  const result = (await handler?.({ max_findings: 3 }, tmp)) as {
    bugHunt: { fixQueue: Array<{ verification: { commands: string[] } }> };
  };

  expect(result.bugHunt.fixQueue.length).toBeGreaterThan(0);
  expect(result.bugHunt.fixQueue.length).toBeLessThanOrEqual(3);
  expect(result.bugHunt.fixQueue[0]?.verification.commands.length).toBeGreaterThan(0);
});
