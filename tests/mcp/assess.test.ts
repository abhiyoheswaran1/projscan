import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';
import type { AssessReport } from '../../src/types.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-assess-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      version: '1.0.0',
      type: 'module',
      devDependencies: { vitest: '^3.0.0' },
      eslintConfig: { root: true },
      prettier: {},
    }),
  );
  await fs.writeFile(
    path.join(tmp, 'README.md'),
    '# fixture\n\nA fixture project with setup and verification notes.\n',
  );
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'index.ts'), 'export const value = 1;\n');
  await fs.writeFile(path.join(tmp, 'src', 'index.test.ts'), 'export const ok = true;\n');
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\n.projscan-memory/\n');
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('lists projscan_assess MCP tool with proof-first inputs', () => {
  const tool = getToolDefinitions().find((entry) => entry.name === 'projscan_assess');

  expect(tool).toBeDefined();
  expect(tool?.description).toContain('proof-first');
  expect(tool?.inputSchema.properties?.goal.description).toContain('assessment goal');
  expect(tool?.inputSchema.properties?.mode.description).toContain('fix-first');
  expect(tool?.inputSchema.properties?.max_cards.description).toContain('Proof Cards');
});

test('projscan_assess returns an assessment report', async () => {
  const handler = getToolHandler('projscan_assess');
  expect(handler).toBeDefined();

  const result = (await handler?.(
    {
      goal: 'make this repo safer',
      mode: 'fix-first',
      max_cards: 2,
    },
    tmp,
  )) as { assess: AssessReport };

  expect(result.assess.schemaVersion).toBe(1);
  expect(result.assess.mode).toBe('fix-first');
  expect(result.assess.proofCards.length).toBeLessThanOrEqual(2);
  expect(result.assess.commands).toContain('projscan assess --mode fix-first --format json');
});

