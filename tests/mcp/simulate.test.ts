import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';
import type { SimulateReport } from '../../src/types.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-simulate-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      version: '1.0.0',
      type: 'module',
      scripts: { test: 'vitest run' },
      devDependencies: { vitest: '^3.0.0' },
    }),
  );
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\n.projscan-memory/\n');
  await fs.mkdir(path.join(tmp, 'src/core'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    "export function buildBugHuntReport(findings: string[]): string[] { return findings; }\n",
  );
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.test.ts'),
    "import { buildBugHuntReport } from './bugHunt.js';\ntest('builds report', () => buildBugHuntReport([]));\n",
  );
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('lists projscan_simulate MCP tool with planning inputs', () => {
  const tool = getToolDefinitions().find((entry) => entry.name === 'projscan_simulate');

  expect(tool).toBeDefined();
  expect(tool?.description).toContain('Simulate');
  expect(tool?.inputSchema.properties?.plan.description).toContain('change plan');
  expect(tool?.inputSchema.properties?.max_files.description).toContain('likely touched files');
  expect(tool?.inputSchema.properties?.max_tokens.description).toContain('Cap the response');
});

test('projscan_simulate returns a simulation report', async () => {
  const handler = getToolHandler('projscan_simulate');
  expect(handler).toBeDefined();

  const result = (await handler?.(
    {
      plan: 'split bugHunt.ts into ranking, evidence, and output modules',
      max_files: 3,
    },
    tmp,
  )) as { simulate: SimulateReport };

  expect(result.simulate.schemaVersion).toBe(1);
  expect(result.simulate.verdict).toBe('worth-doing');
  expect(result.simulate.filesLikelyTouched[0]?.path).toBe('src/core/bugHunt.ts');
  expect(result.simulate.proofCommands).toContain(
    'projscan simulate --plan "split bugHunt.ts into ranking, evidence, and output modules" --format json',
  );
});

