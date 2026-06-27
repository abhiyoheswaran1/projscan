import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { computeGuard } from '../../src/core/guard.js';
import { computeProve } from '../../src/core/prove.js';

const execFileAsync = promisify(execFile);

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-guard-'));
  await fs.writeFile(
    path.join(tmp, 'package.json'),
    `${JSON.stringify(
      {
        name: 'fixture',
        version: '1.0.0',
        type: 'module',
        scripts: { test: 'vitest run' },
        devDependencies: { vitest: '^3.0.0' },
      },
      null,
      2,
    )}\n`,
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
  await computeProve(tmp, {
    intent: 'split bugHunt.ts into ranking, evidence, and output modules',
    saveContractPath: '.projscan/proof-contract.json',
  });
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

test('reports attention when the change stays in scope but proof is missing', async () => {
  await fs.writeFile(
    path.join(tmp, 'src/core/bugHunt.ts'),
    "export function buildBugHuntReport(findings: string[]): string[] { return findings.map(String); }\n",
  );

  const guard = await computeGuard(tmp, {
    contractPath: '.projscan/proof-contract.json',
  });

  expect(guard.status).toBe('attention');
  expect(guard.exitCode).toBe(1);
  expect(guard.summary).toContain('proof');
  expect(guard.drift.files).toEqual([]);
  expect(guard.proof.missingCommands.length).toBeGreaterThan(0);
  expect(guard.mutatedFiles).toEqual([]);
});

test('reports drift for forbidden and unexpected files', async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(tmp, 'package.json'), 'utf-8'));
  pkg.description = 'unexpected release metadata drift';
  await fs.writeFile(path.join(tmp, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

  const guard = await computeGuard(tmp, {
    contractPath: '.projscan/proof-contract.json',
  });

  expect(guard.status).toBe('drift');
  expect(guard.exitCode).toBe(2);
  expect(guard.drift.files).toContain('package.json');
  expect(guard.drift.forbiddenTouched).toContain('package.json');
  expect(guard.reviewerAction).toBe('stop-and-recontract');
});

async function git(args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: tmp });
}
