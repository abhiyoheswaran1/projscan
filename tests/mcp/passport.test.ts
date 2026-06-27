import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';
import type { AgentChangePassport } from '../../src/types.js';

const execFileAsync = promisify(execFile);

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-passport-'));
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
  await fs.mkdir(path.join(tmp, 'tests/core'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    "export function buildBugHuntReport(findings: string[]): string[] { return findings; }\n",
  );
  await fs.writeFile(path.join(tmp, 'tests/core/bugHunt.test.ts'), "test('builds report', () => undefined);\n");
  await git(['init']);
  await git(['config', 'user.email', 'projscan@example.test']);
  await git(['config', 'user.name', 'Projscan Test']);
  await git(['add', '.']);
  await git(['commit', '-m', 'initial']);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('lists projscan_passport MCP tool without proof execution inputs', () => {
  const tool = getToolDefinitions().find((entry) => entry.name === 'projscan_passport');

  expect(tool).toBeDefined();
  expect(tool?.description).toContain('Agent Change Passport');
  expect(tool?.inputSchema.properties?.intent.description).toContain('change intent');
  expect(tool?.inputSchema.properties?.contract_path.description).toContain('Proof Contract');
  expect(tool?.inputSchema.properties?.save_contract_path.description).toContain('write');
  expect(tool?.inputSchema.properties?.output_path.description).toContain('passport');
  expect(tool?.inputSchema.properties?.run).toBeUndefined();
  expect(tool?.inputSchema.properties?.run_command).toBeUndefined();
});

test('projscan_passport returns local reviewer evidence', async () => {
  const handler = getToolHandler('projscan_passport');
  expect(handler).toBeDefined();

  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    "export function buildBugHuntReport(findings: string[]): string[] { return findings.map(String); }\n",
  );

  const result = (await handler?.(
    {
      intent: 'split bugHunt.ts into ranking, evidence, and output modules',
      save_contract_path: '.projscan/proof-contract.json',
      output_path: '.projscan/passport.json',
    },
    tmp,
  )) as { passport: AgentChangePassport };

  expect(result.passport.kind).toBe('agent-change-passport');
  expect(result.passport.boundary.allowedFiles).toContain('src/core/bugHunt.ts');
  expect(result.passport.receipt.changedFiles).toContain('src/core/bugHunt.ts');
  expect(result.passport.reviewer.action).toBe('run-proof');
  expect(result.passport.artifacts.passportPath).toBe('.projscan/passport.json');
});

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}
