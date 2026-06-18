import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { spawnCli } from './cli.js';

const repoRoot = path.resolve(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'dist', 'cli', 'index.js');
const execFileAsync = promisify(execFile);

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runStartCli(cwd: string, args: string[]): Promise<CommandResult> {
  return spawnCli(cliPath, args, { cwd });
}

export async function runScript(
  scriptPath: string,
  args: string[] = [],
  options: { cwd?: string } = {},
): Promise<CommandResult> {
  try {
    const result = await execFileAsync(scriptPath, args, {
      cwd: options.cwd,
      env: process.env,
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}

export function extractNextCommands(stdout: string): string[] {
  const match = stdout.match(/Next Commands\n(?<body>[\s\S]*?)\n\n(?:Top Risks|Watch List)/);
  const body = match?.groups?.body ?? '';
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2));
}

export function extractProofCommands(stdout: string): string[] {
  const match = stdout.match(/Ready Proof\n(?<body>[\s\S]*?)\n\nFirst 10 Minutes/);
  const body = match?.groups?.body ?? '';
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2));
}

export function extractReadyCommands(stdout: string): string[] {
  const match = stdout.match(/Ready Now\n(?<body>[\s\S]*?)\nNeeds Input/);
  const body = match?.groups?.body ?? '';
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^- [^:]+: /, ''));
}
