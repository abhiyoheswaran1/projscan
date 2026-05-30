import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterEach, expect, test } from 'vitest';
import { computeEvidencePack } from '../../src/core/releaseEvidence.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { collectIssues } from '../../src/core/issueEngine.js';
import { analyzeHotspots } from '../../src/core/hotspotAnalyzer.js';
import { saveBaseline } from '../../src/utils/baseline.js';

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];
const PR_COMMENT_TIMEOUT = 120_000;

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

test('docs-only PR comment stays clean short and validator-passing', async () => {
  const root = await makeGitFixture();
  await write('docs/guide.md', '# Guide\n\nSmall docs update.\n', root);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'docs: update guide']);

  const report = await computeEvidencePack(root, { includePrComment: true, maxFindings: 3 });

  expectUsefulPrComment(report);
  expect(report.prComment).toContain('### Trust Calibration');
  expect(report.prComment).toContain('### Baseline Trend');
  expect(report.prComment).toContain('- actual defects: none');
  expect(report.prComment).not.toMatch(/new dataflow risk|new taint flow/i);
  expect(report.prComment).toContain('Add .github/CODEOWNERS line: `docs/** @team-name`');
}, PR_COMMENT_TIMEOUT);

test('auth API PR comment includes owner routing and a fix-first command', async () => {
  const root = await makeGitFixture();
  await write('.github/CODEOWNERS', 'src/auth/** @security-team\nsrc/api/** @api-team\n', root);
  await write('src/auth/session.ts', 'export function requireUser(req: { headers: Record<string, string> }) { return req.headers.authorization; }\n', root);
  await write('src/api/routes.ts', "export function route() { return requireUser({ headers: { authorization: 'token' } }); }\n", root);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'feat: auth api route']);

  const report = await computeEvidencePack(root, { includePrComment: true, maxFindings: 3 });

  expectUsefulPrComment(report);
  expect(report.prSummary?.teamRoutes.map((route) => route.owner).join(' ')).toMatch(/@security-team|@api-team/);
  expect(report.prSummary?.fixFirst?.commands.length).toBeGreaterThan(0);
  expect(report.prComment).toContain('### First Fix');
  expect(report.prComment).toMatch(/@security-team|@api-team/);
}, PR_COMMENT_TIMEOUT);

test('dataflow security PR comment calls out actual defects with owner and review command', async () => {
  const root = await makeGitFixture();
  await write('.github/CODEOWNERS', 'src/api/** @security-team\n', root);
  await write(
    'src/api/run.ts',
    [
      "import { exec } from 'node:child_process';",
      '',
      'export function runSearch() {',
      '  const command = process.env.SEARCH_CMD;',
      "  exec(command ?? 'echo ok');",
      '}',
      '',
    ].join('\n'),
    root,
  );
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'feat: add command-backed api']);

  const report = await computeEvidencePack(root, { includePrComment: true, maxFindings: 3 });

  expectUsefulPrComment(report);
  expect(report.prSummary?.trust.verdict).toBe('actual_defect');
  expect(report.prSummary?.trust.concreteBlockers.join(' ')).toMatch(/taint|dataflow|review/i);
  expect(report.prSummary?.teamRoutes.map((route) => route.owner).join(' ')).toContain('@security-team');
  expect(report.prSummary?.fixFirst?.commands.join(' ')).toMatch(/projscan (review|preflight|doctor)/);
  expect(report.prComment).toContain('- actual defects:');
  expect(report.prComment).toContain('projscan review --format json');
}, PR_COMMENT_TIMEOUT);

test('large release PR comment stays manual-review calibrated instead of calling scale a defect', async () => {
  const root = await makeGitFixture();
  await write(
    'src/platform.ts',
    [
      'export function complex(value: number) {',
      ...Array.from({ length: 24 }, (_, index) => '  if (value > ' + (index + 1) + ') return ' + (index + 1) + ';'),
      '  return 0;',
      '}',
      '',
    ].join('\n'),
    root,
  );
  await write('docs/release.md', '# Release notes\n', root);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'feat: large platform change']);

  const report = await computeEvidencePack(root, { includePrComment: true, maxFindings: 3, preflightMaxChangedFiles: 1 });

  expectUsefulPrComment(report);
  expect(report.prSummary?.trust.verdict).toBe('manual_review');
  expect(report.verdict).toBe('caution');
  expect(report.prComment).toContain('**Verdict:** caution');
  expect(report.prSummary?.trust.concreteBlockers).toEqual([]);
  expect(report.prSummary?.trust.manualReviewSignals.join(' ')).toMatch(/Large platform release risk|scale\/complexity/i);
  expect(report.prComment).toContain('- actual defects: none');
  expect(report.prComment).toMatch(/manual release sign-off|manual review/i);
}, PR_COMMENT_TIMEOUT);

test('generated-code PR comment suppresses default generated taint and dataflow anxiety', async () => {
  const root = await makeGitFixture();
  await write(
    'src/__generated__/client.ts',
    [
      "import { exec } from 'node:child_process';",
      '',
      'export function generatedClient() {',
      '  const command = process.env.GENERATED_CMD;',
      "  exec(command ?? 'echo generated');",
      '}',
      '',
    ].join('\n'),
    root,
  );
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'chore: regenerate api client']);

  const report = await computeEvidencePack(root, { includePrComment: true, maxFindings: 3 });

  expectUsefulPrComment(report);
  expect(report.prSummary?.trust.concreteBlockers).toEqual([]);
  expect(report.prComment).toContain('- actual defects: none');
  expect(report.prComment).not.toMatch(/new taint flow|new dataflow risk/i);
}, PR_COMMENT_TIMEOUT);

function expectUsefulPrComment(report: Awaited<ReturnType<typeof computeEvidencePack>>): void {
  const body = report.prComment ?? '';
  if (report.currentVersion) expect(body).toContain(`**Version:** ${report.currentVersion}`);
  if (report.currentVersion && report.verdict !== "blocked") expect(report.summary).toContain(report.currentVersion);
  expect(report.prCommentValidation?.status).toBe('pass');
  expect(body.length).toBeLessThan(12000);
  expect(body).toContain('### Verdict');
  expect(body).toContain('### First Fix');
  expect(body).toContain('### Team Routing');
  expect(body).toContain('### Next Commands');
  expect(body).toContain('### Developer Feedback');
  expect(body).toMatch(/useful on this PR/i);
  expect(body).toMatch(/missing or noisy/i);
  expect(body).toMatch(/### Team Routing[\s\S]*(?:@[a-z0-9_-]+|CODEOWNERS)/i);
  expect(body).toMatch(/### Next Commands[\s\S]*`(?:projscan|npm|npx|gh|git)\b/);
}
async function makeGitFixture(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-pr-comment-'));
  tempRoots.push(root);
  await git(root, ['init', '-b', 'main']);
  await git(root, ['config', 'user.email', 'projscan@example.com']);
  await git(root, ['config', 'user.name', 'projscan']);
  await write('package.json', JSON.stringify({ name: 'fixture', version: '0.0.0', type: 'module', scripts: { test: 'node --test' } }, null, 2) + '\n', root);
  await write('README.md', '# fixture\n', root);
  await write('src/index.ts', 'export const value = 1;\n', root);
  await git(root, ['add', '.']);
  await git(root, ['commit', '-m', 'chore: baseline']);
  const scan = await scanRepository(root);
  const issues = await collectIssues(root, scan.files);
  const hotspots = await analyzeHotspots(root, scan.files, issues, { limit: 20 });
  await saveBaseline(root, issues, hotspots);
  await git(root, ['add', '.projscan-baseline.json']);
  await git(root, ['commit', '-m', 'chore: save projscan baseline']);
  await git(root, ['checkout', '-b', 'feature/projscan-pr']);
  return root;
}

async function write(relativePath: string, content: string, root: string): Promise<void> {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
}

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd, timeout: 30000, maxBuffer: 1024 * 1024 });
}
