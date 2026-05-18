import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-preflight-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module' }),
  );
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('lists projscan_preflight as an MCP tool', () => {
  const names = getToolDefinitions().map((tool) => tool.name);

  expect(names).toContain('projscan_preflight');
});

test('projscan_preflight returns the shared preflight report shape', async () => {
  const handler = getToolHandler('projscan_preflight');
  expect(handler).toBeDefined();

  const result = (await handler?.({ mode: 'before_edit' }, tmp)) as {
    report: { schemaVersion: number; mode: string; verdict: string; summary: string };
  };

  expect(result.report.schemaVersion).toBe(1);
  expect(result.report.mode).toBe('before_edit');
  expect(['proceed', 'caution', 'block']).toContain(result.report.verdict);
  expect(result.report.summary).toContain(result.report.verdict);
});
