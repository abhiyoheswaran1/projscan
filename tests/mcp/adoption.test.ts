import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-adoption-'));
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

test('lists projscan_adoption as an MCP tool', () => {
  const tools = getToolDefinitions();
  const names = tools.map((tool) => tool.name);
  const tool = tools.find((entry) => entry.name === 'projscan_adoption');

  expect(names).toContain('projscan_adoption');
  expect(tool?.inputSchema.properties).toEqual(
    expect.objectContaining({
      action: expect.objectContaining({
        enum: ['mcp_config', 'recipes', 'first_run'],
      }),
      client: expect.objectContaining({ type: 'string' }),
    }),
  );
});

test('projscan_adoption returns MCP config snippets for a client', async () => {
  const handler = getToolHandler('projscan_adoption');
  expect(handler).toBeDefined();

  const result = (await handler?.({ action: 'mcp_config', client: 'codex' }, tmp)) as {
    config: {
      client: string;
      config: { mcpServers: { projscan: { command: string; args: string[] } } };
    };
  };

  expect(result.config.client).toBe('codex');
  expect(result.config.config.mcpServers.projscan.command).toBe('npx');
  expect(result.config.config.mcpServers.projscan.args).toEqual(['-y', 'projscan', 'mcp']);
});

test('projscan_adoption returns recipes and first-run diagnostics', async () => {
  const handler = getToolHandler('projscan_adoption');
  expect(handler).toBeDefined();

  const recipes = (await handler?.({ action: 'recipes' }, tmp)) as {
    recipes: { recipes: Array<{ id: string; commands: string[] }> };
  };
  expect(recipes.recipes.recipes.map((recipe) => recipe.id)).toContain('release_approval');

  const firstRun = (await handler?.({ action: 'first_run' }, tmp)) as {
    firstRun: { diagnostics: Array<{ id: string; status: string }> };
  };
  expect(firstRun.firstRun.diagnostics.map((diagnostic) => diagnostic.id)).toContain('mcp-startup');
});
