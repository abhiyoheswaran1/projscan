import { runReviewGit } from './reviewGit.js';

export async function isGitRepository(rootPath: string): Promise<boolean> {
  const { code } = await runReviewGit(rootPath, ['rev-parse', '--is-inside-work-tree']).catch(
    () => ({
      code: 1,
      stdout: '',
      stderr: '',
    }),
  );
  return code === 0;
}

export async function isWorktreeClean(rootPath: string): Promise<boolean> {
  const unstaged = await runReviewGit(rootPath, [
    'diff',
    '--quiet',
    '--ignore-submodules',
    '--',
  ]).catch(() => ({
    code: 1,
    stdout: '',
    stderr: '',
  }));
  if (unstaged.code !== 0) return false;

  const staged = await runReviewGit(rootPath, [
    'diff',
    '--cached',
    '--quiet',
    '--ignore-submodules',
    '--',
  ]).catch(() => ({
    code: 1,
    stdout: '',
    stderr: '',
  }));
  if (staged.code !== 0) return false;

  const untracked = await runReviewGit(rootPath, [
    'ls-files',
    '--others',
    '--exclude-standard',
  ]).catch(() => ({
    code: 1,
    stdout: '',
    stderr: '',
  }));
  return untracked.code === 0 && untracked.stdout.trim().length === 0;
}

export async function resolveSha(rootPath: string, ref: string): Promise<string | null> {
  const { code, stdout } = await runReviewGit(rootPath, [
    'rev-parse',
    '--verify',
    `${ref}^{commit}`,
  ]).catch(() => ({ code: 1, stdout: '', stderr: '' }));
  if (code !== 0) return null;
  const sha = stdout.trim();
  return sha || null;
}

export async function pickDefaultBase(rootPath: string): Promise<string> {
  for (const candidate of ['origin/main', 'main', 'origin/master', 'master']) {
    if (await resolveSha(rootPath, candidate)) return candidate;
  }
  return 'HEAD~1';
}
