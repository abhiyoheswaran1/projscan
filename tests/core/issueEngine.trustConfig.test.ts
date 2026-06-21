import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { collectIssues } from '../../src/core/issueEngine.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';

const execFileAsync = promisify(execFile);
const FAKE_AWS_ACCESS_KEY = `AKIA${'IOSFODNN7EXAMPLE'}`;

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-issue-engine-trust-'));
  await execFileAsync('git', ['init', '-q'], { cwd: tmp });
  await write('.gitignore', '.env\n');
  await write('.env', `AWS_ACCESS_KEY_ID="${FAKE_AWS_ACCESS_KEY}"\n`);
  await write('src/index.ts', 'export const visible = true;\n');
  await execFileAsync('git', ['add', '.gitignore', 'src/index.ts'], { cwd: tmp });
  await execFileAsync('git', ['add', '-f', '.env'], { cwd: tmp });
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const target = path.join(tmp, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
}

describe('collectIssues trust config', () => {
  it('keeps tracked .env values path-only by default', async () => {
    const scan = await scanRepository(tmp);
    const issues = await collectIssues(tmp, scan.files);

    expect(issues.find((issue) => issue.id === 'env-file-committed')).toBeDefined();
    expect(issues.find((issue) => issue.id === 'hardcoded-secret')).toBeUndefined();
  });

  it('reads tracked .env values when scan.scanEnvValues is explicitly configured', async () => {
    await write('.projscanrc.json', JSON.stringify({ scan: { scanEnvValues: true } }));
    await execFileAsync('git', ['add', '.projscanrc.json'], { cwd: tmp });

    const scan = await scanRepository(tmp);
    const issues = await collectIssues(tmp, scan.files);

    expect(issues.find((issue) => issue.id === 'env-file-committed')).toBeDefined();
    expect(issues.find((issue) => issue.id === 'hardcoded-secret')).toBeDefined();
  });

  it('honors line-scoped inline suppressions without hiding other rules', async () => {
    await write(
      'src/firebase.ts',
      [
        `const publicKey = "${FAKE_AWS_ACCESS_KEY}"; // projscan-ignore-line hardcoded-secret -- test public fixture`,
        '',
      ].join('\n'),
    );
    await write('src/real-secret.ts', `const realKey = "${FAKE_AWS_ACCESS_KEY}";\n`);
    const scan = await scanRepository(tmp);
    const issues = await collectIssues(tmp, scan.files);
    const secrets = issues.filter((issue) => issue.id === 'hardcoded-secret');

    expect(secrets).toHaveLength(1);
    expect(secrets[0].locations?.[0]).toEqual({ file: 'src/real-secret.ts', line: 1 });
    expect(issues.find((issue) => issue.id === 'env-file-committed')).toBeDefined();
  });
});
