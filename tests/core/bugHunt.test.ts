import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, expect, test } from 'vitest';
import { computeBugHunt } from '../../src/core/bugHunt.js';

const tempRoots: string[] = [];
const execFileAsync = promisify(execFile);

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

test('bug hunt ranks fix queue from doctor issues and verification commands', async () => {
  const root = await makeTempProject();
  await fs.writeFile(path.join(root, 'src', 'danger.ts'), 'eval("console.log(1)");\n');

  const report = await computeBugHunt(root, { maxFindings: 5 });

  expect(report.schemaVersion).toBe(1);
  expect(report.verdict).toBe('fix');
  expect(report.summary).toContain('bug hunt');
  expect(report.fixQueue.length).toBeGreaterThan(0);
  expect(report.fixQueue.length).toBeLessThanOrEqual(5);
  expect(report.fixQueue[0]).toEqual(
    expect.objectContaining({
      priority: expect.stringMatching(/^p[012]$/),
      verification: expect.objectContaining({
        commands: expect.arrayContaining(['projscan doctor --format json']),
      }),
    }),
  );
  expect(report.verificationMatrix.map((entry) => entry.command)).toEqual(
    expect.arrayContaining(['projscan doctor --format json', 'npm test']),
  );
  expect(report.verificationMatrix[0]).toEqual(
    expect.objectContaining({
      command: 'projscan doctor --format json',
      reason: 'Confirms the issue queue after fixes.',
    }),
  );
  expect(report.verificationMatrix.at(-1)).toEqual(
    expect.objectContaining({
      command: 'npm test',
      reason: 'Keeps the bug hunt tied to repeatable regression coverage.',
    }),
  );
});

test('bug hunt includes clean verification guidance when no issues are found', async () => {
  const root = await makeTempProject({
    packageJson: {
      name: 'fixture',
      version: '0.0.0',
      type: 'module',
      devDependencies: { vitest: '^3.0.0' },
      eslintConfig: { root: true },
      prettier: {},
    },
    testFile: true,
    gitignore: true,
  });

  const report = await computeBugHunt(root, { maxFindings: 3 });

  expect(report.schemaVersion).toBe(1);
  expect(report.fixQueue.length).toBeGreaterThan(0);
  expect(report.fixQueue[0]?.id).toBe('bh-verify-clean');
  expect(report.verificationMatrix.length).toBeGreaterThan(0);
});

test('bug hunt treats pure hotspot churn as watchlist instead of an immediate fix queue', async () => {
  const root = await makeTempProject({
    packageJson: {
      name: 'fixture',
      version: '0.0.0',
      type: 'module',
      devDependencies: { vitest: '^3.0.0' },
      eslintConfig: { root: true },
      prettier: {},
    },
    testFile: true,
    gitignore: true,
  });
  await git(root, ['init']);
  await git(root, ['config', 'user.email', 'agent@example.com']);
  await git(root, ['config', 'user.name', 'Agent']);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'baseline']);
  for (let i = 0; i < 8; i += 1) {
    await fs.writeFile(
      path.join(root, 'src', 'index.ts'),
      `export const value = ${i};
`,
    );
    await git(root, ['add', 'src/index.ts']);
    await git(root, ['commit', '-m', `touch ${i}`]);
  }

  const report = await computeBugHunt(root, { maxFindings: 5 });

  expect(report.health.errors).toBe(0);
  expect(report.health.warnings).toBe(0);
  expect(report.evidence.hotspotCount).toBeGreaterThan(0);
  expect(report.verdict).toBe('clean');
  expect(report.fixQueue[0]?.id).toBe('bh-verify-clean');
  expect(report.topSuspects.some((finding) => finding.source === 'hotspot')).toBe(true);
  const hotspotFinding = report.topSuspects.find((finding) => finding.source === 'hotspot');
  expect(hotspotFinding?.why).toContain('primary author');
  expect(hotspotFinding?.evidence.map((entry) => entry.message)).toEqual(
    expect.arrayContaining([expect.stringContaining('primary author')]),
  );
}, 120_000);

test('bug hunt applies project config before ranking doctor issues', async () => {
  const root = await makeTempProject();
  await writeJson(path.join(root, '.projscanrc.json'), {
    disableRules: [
      'missing-test-framework',
      'missing-eslint',
      'missing-prettier',
      'gitignore-missing-env',
      'empty-readme',
      'missing-editorconfig',
    ],
  });

  const report = await computeBugHunt(root, { maxFindings: 5 });

  expect(report.evidence.issueCounts).toEqual({ errors: 0, warnings: 0, infos: 0 });
  expect(report.fixQueue.some((finding) => finding.id.includes('missing-test-framework'))).toBe(
    false,
  );
});

test('bug hunt orders preflight fallback files by review usefulness', async () => {
  const root = await makeTempProject({
    packageJson: {
      name: 'fixture',
      version: '0.0.0',
      type: 'module',
      devDependencies: { vitest: '^3.0.0' },
      eslintConfig: { root: true },
      prettier: {},
    },
    testFile: true,
    gitignore: true,
  });
  await git(root, ['init']);
  await git(root, ['config', 'user.email', 'agent@example.com']);
  await git(root, ['config', 'user.name', 'Agent']);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'baseline']);

  for (let i = 2; i <= 6; i++) {
    await fs.writeFile(path.join(root, 'src', 'index.ts'), `export const value = ${i};\n`);
    await git(root, ['add', 'src/index.ts']);
    await git(root, ['commit', '-m', `churn ${i}`]);
  }

  await fs.mkdir(path.join(root, '.agentflight'), { recursive: true });
  await writeJson(path.join(root, '.agentflight', 'config.json'), { localOnly: true });
  await writeJson(path.join(root, 'package.json'), {
    name: 'fixture',
    version: '0.0.1',
    type: 'module',
    devDependencies: { vitest: '^3.0.0' },
    eslintConfig: { root: true },
    prettier: {},
  });
  await writeJson(path.join(root, 'package-lock.json'), {
    name: 'fixture',
    version: '0.0.1',
    lockfileVersion: 3,
    packages: {},
  });
  await fs.writeFile(
    path.join(root, 'README.md'),
    '# fixture\n\nUpdated release notes, setup notes, usage examples, and verification guidance.\n',
  );
  await fs.mkdir(path.join(root, 'packages', 'api'), { recursive: true });
  await writeJson(path.join(root, 'packages', 'api', 'package.json'), {
    name: '@fixture/api',
    version: '0.0.1',
  });
  await fs.writeFile(path.join(root, 'src', 'index.test.ts'), 'export const ok = false;\n');
  await fs.writeFile(
    path.join(root, 'src', 'index.ts'),
    'export const value = 7;\nexport const releaseGate = true;\n',
  );

  const report = await computeBugHunt(root, { maxFindings: 5 });
  const preflightFinding = report.fixQueue.find((finding) => finding.source === 'preflight');

  expect(report.verdict).toBe('fix');
  expect(report.summary).toBe('review: bug hunt found 1 manual sign-off action(s)');
  expect(report.summary).toContain('manual sign-off action');
  expect(report.summary).not.toContain('fix:');
  expect(report.verificationMatrix).toEqual([
    expect.objectContaining({
      command: 'projscan preflight --mode before_commit --format json',
      reason: 'Confirms the manual sign-off gate and any remaining concrete blockers.',
      expected:
        'Manual sign-off is documented, or the preflight verdict returns proceed after review.',
    }),
    expect.objectContaining({
      command: 'projscan doctor --format json',
      reason: 'Confirms no concrete doctor issue is hidden behind the review gate.',
      expected: 'No unresolved error-level issues and expected warning count is explained.',
    }),
  ]);
  expect(report.verificationMatrix.map((entry) => entry.reason).join(' ')).not.toContain(
    'after fixes',
  );
  expect(preflightFinding?.title).toBe('Review preflight release sign-off');
  expect(report.fixFirst?.whyFirst.match(/manual release sign-off/gi) ?? []).toHaveLength(1);
  expect(preflightFinding?.files.slice(0, 4)).toEqual([
    'package.json',
    'package-lock.json',
    'packages/api/package.json',
    'src/index.ts',
  ]);
  expect(preflightFinding?.files.indexOf('README.md')).toBeGreaterThan(
    preflightFinding?.files.indexOf('src/index.test.ts') ?? -1,
  );
  expect(preflightFinding?.files.at(-1)).toBe('.agentflight/config.json');
  expect(preflightFinding?.evidence[0]).toEqual(
    expect.objectContaining({
      file: 'package.json',
    }),
  );
}, 120_000);

async function git(root: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: root });
}

async function makeTempProject(
  options: {
    packageJson?: Record<string, unknown>;
    testFile?: boolean;
    gitignore?: boolean;
  } = {},
): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-bug-hunt-'));
  tempRoots.push(root);
  await writeJson(
    path.join(root, 'package.json'),
    options.packageJson ?? { name: 'fixture', version: '0.0.0', type: 'module' },
  );
  await fs.writeFile(
    path.join(root, 'README.md'),
    '# fixture\n\nA small fixture project with setup notes, usage examples, and verification guidance.\n',
  );
  if (options.gitignore) await fs.writeFile(path.join(root, '.gitignore'), '.env\nnode_modules\n');
  if (options.gitignore) await fs.writeFile(path.join(root, '.editorconfig'), 'root = true\n');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'index.ts'), 'export const value = 1;\n');
  if (options.testFile)
    await fs.writeFile(path.join(root, 'src', 'index.test.ts'), 'export const ok = true;\n');
  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
