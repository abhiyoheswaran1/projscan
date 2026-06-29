import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { getToolDefinitions, getToolHandler } from '../../src/mcp/tools.js';
import type { ReviewGateReport } from '../../src/types.js';

const execFileAsync = promisify(execFile);

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-mcp-review-gate-'));
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

test('lists projscan_review_gate MCP tool without proof execution inputs', () => {
  const tool = getToolDefinitions().find((entry) => entry.name === 'projscan_review_gate');

  expect(tool).toBeDefined();
  expect(tool?.description).toContain('Review Gate');
  expect(tool?.inputSchema.properties?.intent.description).toContain('change intent');
  expect(tool?.inputSchema.properties?.contract_path.description).toContain('Proof Contract');
  expect(tool?.inputSchema.properties?.output_path.description).toContain('Review Gate');
  expect(tool?.inputSchema.properties?.run).toBeUndefined();
  expect(tool?.inputSchema.properties?.run_command).toBeUndefined();
  expect(tool?.inputSchema.properties?.include_pr_comment).toBeUndefined();
});

test('projscan_review_gate returns reviewer-ready gate evidence', async () => {
  const handler = getToolHandler('projscan_review_gate');
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
      output_path: '.projscan/review-gate.json',
    },
    tmp,
  )) as { reviewGate: ReviewGateReport };

  expect(result.reviewGate.kind).toBe('review-gate');
  expect(result.reviewGate.status).toBe('needs-proof');
  expect(result.reviewGate.decision.allowReview).toBe(false);
  expect(result.reviewGate.proofDebt.total).toBeGreaterThan(0);
  expect(result.reviewGate.requiredReviewers).toContain('@billing-platform');
  expect(result.reviewGate.prComment.markdown).toContain('## Projscan Review Gate');
  expect(result.reviewGate.artifacts.reviewGatePath).toBe('.projscan/review-gate.json');
});

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}
