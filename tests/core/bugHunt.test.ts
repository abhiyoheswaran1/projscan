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
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
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
    await fs.writeFile(path.join(root, 'src', 'index.ts'), `export const value = ${i};
`);
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
});

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
  expect(report.fixQueue.some((finding) => finding.id.includes('missing-test-framework'))).toBe(false);
});


async function git(root: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: root });
}

async function makeTempProject(options: {
  packageJson?: Record<string, unknown>;
  testFile?: boolean;
  gitignore?: boolean;
} = {}): Promise<string> {
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
  if (options.testFile) await fs.writeFile(path.join(root, 'src', 'index.test.ts'), 'export const ok = true;\n');
  return root;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
