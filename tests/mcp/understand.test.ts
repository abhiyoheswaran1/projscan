import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-understand-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    `${JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module', exports: './src/server.ts' }, null, 2)}\n`,
  );
  await fs.writeFile(path.join(tmp, 'README.md'), '# fixture\n');
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'config.ts'), 'export function loadConfig() { return process.env.API_KEY; }\n');
  await fs.writeFile(path.join(tmp, 'src', 'server.ts'), 'import { loadConfig } from "./config"; export function createApp() { return loadConfig(); }\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('lists projscan_understand MCP tool', () => {
  const names = getToolDefinitions().map((tool) => tool.name);

  expect(names).toContain('projscan_understand');
});

test('projscan_understand returns the understand report shape', async () => {
  const handler = getToolHandler('projscan_understand');
  expect(handler).toBeDefined();

  const result = (await handler?.({ view: 'contracts', max_items: 5 }, tmp)) as {
    understand: { view: string; contracts: { configContracts: Array<{ name: string }> }; claims: unknown[] };
  };

  expect(result.understand.view).toBe('contracts');
  expect(result.understand.claims.length).toBeGreaterThan(0);
  expect(result.understand.contracts.configContracts.map((entry) => entry.name)).toContain('API_KEY');
});
