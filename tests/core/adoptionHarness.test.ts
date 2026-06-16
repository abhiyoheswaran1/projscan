import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, expect, test } from 'vitest';
import { writeTeamStarterKit } from '../../src/core/adoption.js';
import { computeEvidencePack } from '../../src/core/releaseEvidence.js';
import { computePreflight } from '../../src/core/preflight.js';

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('team onboarding harness proves init team baseline workflow PR comment preflight and owner routing together', async () => {
  const root = await makeTeamRepo();
  const starter = await writeTeamStarterKit(root, 'security');

  expect(starter.created).toEqual({
    policy: true,
    githubAction: true,
    codeowners: true,
    baseline: true,
  });
  expect(starter.nextCommands).toEqual(
    expect.arrayContaining(['projscan evidence-pack --pr-comment']),
  );
  expect(await readRelative(root, '.github/workflows/projscan.yml')).toContain(
    'Validate PR comment',
  );
  expect(await readRelative(root, '.github/CODEOWNERS')).toContain('@security-team');

  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'chore: adopt projscan team harness']);
  await git(root, ['checkout', '-b', 'feature/first-team-pr']);
  await write(
    root,
    'src/api/search.ts',
    [
      'export async function POST(request: Request) {',
      '  const body = await request.json();',
      '  return Response.json({ q: body.q });',
      '}',
      '',
    ].join('\n'),
  );
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'feat: first team api route']);

  const preflight = await computePreflight(root, { mode: 'before_merge' });
  const evidence = await computeEvidencePack(root, { includePrComment: true, maxFindings: 3 });

  expect(preflight.evidence.changedFiles.available).toBe(true);
  expect(preflight.evidence.changedFiles.files).toContain('src/api/search.ts');
  expect(evidence.prCommentValidation?.status).toBe('pass');
  expect(evidence.prSummary?.baselineTrend).toBeDefined();
  expect(evidence.prSummary?.teamRoutes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        owner: '@security-team',
        files: expect.arrayContaining(['src/api/search.ts']),
      }),
    ]),
  );
  expect(evidence.prComment).toContain('### First Fix');
  expect(evidence.prComment).toContain('### Baseline Trend');
  expect(evidence.prComment).toContain('@security-team');
}, 180000);

async function makeTeamRepo(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-adoption-harness-'));
  tempRoots.push(root);
  await git(root, ['init', '-b', 'main']);
  await git(root, ['config', 'user.email', 'projscan@example.com']);
  await git(root, ['config', 'user.name', 'projscan']);
  await write(
    root,
    'package.json',
    JSON.stringify(
      { name: 'team-fixture', version: '0.0.0', type: 'module', scripts: { test: 'node --test' } },
      null,
      2,
    ) + '\n',
  );
  await write(root, 'README.md', '# team fixture\n');
  await write(root, 'src/index.ts', 'export const baseline = 1;\n');
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'chore: baseline']);
  return root;
}

async function write(root: string, relativePath: string, content: string): Promise<void> {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
}

async function readRelative(root: string, relativePath: string): Promise<string> {
  return fs.readFile(path.join(root, relativePath), 'utf-8');
}

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd, timeout: 120000, maxBuffer: 1024 * 1024 });
}
