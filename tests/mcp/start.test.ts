import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-start-'));
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

test('lists projscan_start as an MCP tool', () => {
  const tool = getToolDefinitions().find((entry) => entry.name === 'projscan_start');

  expect(tool).toBeDefined();
  expect(tool?.inputSchema.properties).toEqual(
    expect.objectContaining({
      mode: expect.objectContaining({ enum: expect.arrayContaining(['before_edit', 'bug_hunt', 'release']) }),
      include_handoff: expect.objectContaining({ type: 'boolean' }),
      max_tokens: expect.objectContaining({ type: 'number' }),
    }),
  );
});

test('projscan_start returns first-run guidance and next actions', async () => {
  const handler = getToolHandler('projscan_start');
  expect(handler).toBeDefined();

  const result = (await handler?.({ mode: 'release', max_tasks: 2, include_handoff: true }, tmp)) as {
    start: {
      schemaVersion: number;
      mode: string;
      recommendedWorkflow: { id: string; commands: string[] };
      nextActions: Array<{ command?: string }>;
      firstTenMinutes: { commands: Array<{ command: string }> };
      handoff?: { next: string[] };
    };
  };

  expect(result.start.schemaVersion).toBe(1);
  expect(result.start.mode).toBe('release');
  expect(result.start.recommendedWorkflow.id).toBe('release_approval');
  expect(result.start.recommendedWorkflow.commands).toContain('projscan release-train --format json');
  expect(result.start.firstTenMinutes.commands[0].command).toBe('projscan privacy-check --offline');
  expect(result.start.nextActions.length).toBeGreaterThan(0);
  expect(result.start.handoff?.next.length).toBeGreaterThan(0);
});
