import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';
import type { ProofBrokerReport } from '../../src/types.js';

const execFileAsync = promisify(execFile);

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-proof-broker-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    JSON.stringify({
      name: 'billing-fixture',
      version: '1.0.0',
      type: 'module',
      scripts: { 'test:billing': 'vitest run tests/billing/retryPolicy.test.ts' },
      devDependencies: { vitest: '^3.0.0' },
    }),
  );
  await fs.writeFile(
    path.join(tmp, '.projscanrc.json'),
    JSON.stringify({
      proofRecipes: [
        {
          id: 'billing-retry-safety',
          matches: ['src/billing/**'],
          requiredCommands: ['npm run test:billing'],
          requiredReviewers: ['@billing-platform'],
        },
      ],
    }),
  );
  await fs.writeFile(path.join(tmp, '.gitignore'), '.env\n.projscan-memory/\n');
  await fs.mkdir(path.join(tmp, 'src/billing'), { recursive: true });
  await fs.mkdir(path.join(tmp, 'tests/billing'), { recursive: true });
  await fs.writeFile(
    path.join(tmp, 'src/billing/retryPolicy.ts'),
    "export function nextRetryDelay(attempt: number): number { return Math.min(attempt * 1000, 5000); }\n",
  );
  await fs.writeFile(path.join(tmp, 'tests/billing/retryPolicy.test.ts'), "test('caps', () => undefined);\n");
  await git(['init']);
  await git(['config', 'user.email', 'projscan@example.test']);
  await git(['config', 'user.name', 'Projscan Test']);
  await git(['add', '.']);
  await git(['commit', '-m', 'initial billing retry']);
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('lists projscan_proof_broker MCP tool without proof execution inputs', () => {
  const tool = getToolDefinitions().find((entry) => entry.name === 'projscan_proof_broker');

  expect(tool).toBeDefined();
  expect(tool?.description).toContain('Proof Broker');
  expect(tool?.inputSchema.properties?.intent.description).toContain('change intent');
  expect(tool?.inputSchema.properties?.contract_path.description).toContain('Proof Contract');
  expect(tool?.inputSchema.properties?.output_passport_path.description).toContain('passport');
  expect(tool?.inputSchema.properties?.run).toBeUndefined();
  expect(tool?.inputSchema.properties?.run_command).toBeUndefined();
  expect(tool?.inputSchema.properties?.include_pr_passport).toBeUndefined();
});

test('projscan_proof_broker returns reviewer-ready proof evidence', async () => {
  const handler = getToolHandler('projscan_proof_broker');
  expect(handler).toBeDefined();

  await fs.writeFile(
    path.join(tmp, 'src/billing/retryPolicy.ts'),
    "export function nextRetryDelay(attempt: number): number { return Math.min(2 ** attempt * 250, 8000); }\n",
  );

  const result = (await handler?.(
    {
      intent: 'is my agent allowed to change billing retry logic?',
      save_contract_path: '.projscan/proof-contract.json',
      output_passport_path: '.projscan/passport.json',
    },
    tmp,
  )) as { proofBroker: ProofBrokerReport };

  expect(result.proofBroker.kind).toBe('proof-broker');
  expect(result.proofBroker.reviewer.action).toBe('run-proof');
  expect(result.proofBroker.scope.changedFiles).toContain('src/billing/retryPolicy.ts');
  expect(result.proofBroker.requiredReviewers).toContain('@billing-platform');
  expect(result.proofBroker.requiredProof.map((row) => row.id)).toContain(
    'recipe:billing-retry-safety',
  );
  expect(result.proofBroker.prPassport.markdown).toContain('## Projscan PR Passport');
});

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}
