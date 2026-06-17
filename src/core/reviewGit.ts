import { spawn } from 'node:child_process';

export interface ReviewGitResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Default cap on any single git invocation made from the review pipeline.
 * Without it a hung credential prompt, blocking hook, or dead remote could
 * hang the MCP server until killed.
 */
const DEFAULT_GIT_TIMEOUT_MS = 30_000;

export function runReviewGit(cwd: string, args: string[]): Promise<ReviewGitResult> {
  return new Promise((resolve, reject) => {
    // Detach stdin so credential prompts / interactive hooks see EOF
    // and exit instead of waiting forever.
    const child = spawn('git', args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`git command timed out after ${DEFAULT_GIT_TIMEOUT_MS}ms`));
    }, DEFAULT_GIT_TIMEOUT_MS);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export function gitFailureSummary(result: ReviewGitResult): string {
  const message = (result.stderr || result.stdout).trim().replace(/\s+/g, ' ');
  return message || `git exited with code ${result.code}`;
}
