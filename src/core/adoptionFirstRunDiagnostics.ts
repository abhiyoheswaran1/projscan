import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { INSTALL } from './adoptionMcpConfig.js';
import { buildFirstTenMinutes } from './onboarding.js';
import { PLUGIN_PREVIEW_FLAG, discoverPluginManifests } from './plugins.js';
import type { StartFirstTenMinutes } from '../types/start.js';

const execFileAsync = promisify(execFile);

export type FirstRunStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface FirstRunDiagnostic {
  id: string;
  label: string;
  status: FirstRunStatus;
  summary: string;
  detail?: string;
  command?: string;
}

export interface FirstRunReport {
  schemaVersion: 1;
  rootPath: string;
  overall: FirstRunStatus;
  diagnostics: FirstRunDiagnostic[];
  firstTenMinutes: StartFirstTenMinutes;
  nextCommands: string[];
}

export async function computeFirstRunDiagnostics(rootPath: string): Promise<FirstRunReport> {
  const diagnostics: FirstRunDiagnostic[] = [
    checkNodeVersion(),
    await checkPackageJson(rootPath),
    await checkGit(rootPath),
    await checkConfig(rootPath),
    await checkTreeSitter(rootPath),
    await checkPlugins(rootPath),
    checkMcpStartup(),
  ];
  const overall = summarizeDiagnostics(diagnostics);
  const firstTenMinutes = buildFirstTenMinutes();
  return {
    schemaVersion: 1,
    rootPath,
    overall,
    diagnostics,
    firstTenMinutes,
    nextCommands: dedupeCommands([
      ...firstTenMinutes.commands.map((step) => step.command),
      'projscan init mcp --client all',
      'projscan recipes',
      'projscan preflight --mode before_edit --format json',
      'projscan doctor',
    ]),
  };
}

export function checkNodeVersion(): FirstRunDiagnostic {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  if (Number.isFinite(major) && major >= 18) {
    return {
      id: 'node',
      label: 'Node.js',
      status: 'pass',
      summary: `Node ${process.versions.node} satisfies projscan's >=18 requirement.`,
    };
  }
  return {
    id: 'node',
    label: 'Node.js',
    status: 'fail',
    summary: `Node ${process.versions.node} is below projscan's >=18 requirement.`,
    command: 'node --version',
  };
}

async function checkPackageJson(rootPath: string): Promise<FirstRunDiagnostic> {
  const file = path.join(rootPath, 'package.json');
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as { name?: unknown; scripts?: unknown };
    const name = typeof parsed.name === 'string' ? parsed.name : path.basename(rootPath);
    const scripts =
      parsed.scripts && typeof parsed.scripts === 'object' ? Object.keys(parsed.scripts).length : 0;
    return {
      id: 'package-json',
      label: 'Package metadata',
      status: 'pass',
      summary: `Found package.json for ${name}.`,
      detail:
        scripts > 0
          ? `${scripts} npm script(s) detected for release/test recipes.`
          : 'No npm scripts detected.',
    };
  } catch (err) {
    return {
      id: 'package-json',
      label: 'Package metadata',
      status: 'warn',
      summary: 'No readable package.json found; Node dependency and script checks will be limited.',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkGit(rootPath: string): Promise<FirstRunDiagnostic> {
  let inside: { stdout: string };
  try {
    inside = await git(rootPath, ['rev-parse', '--is-inside-work-tree']);
  } catch (err) {
    return {
      id: 'git',
      label: 'Git',
      status: 'warn',
      summary: 'Git metadata is unavailable.',
      detail: err instanceof Error ? err.message : String(err),
      command: 'git rev-parse --is-inside-work-tree',
    };
  }
  if (inside.stdout.trim() !== 'true') {
    return {
      id: 'git',
      label: 'Git',
      status: 'warn',
      summary: 'This directory is not inside a Git worktree.',
      detail: 'Review, changed-file, and pre-merge recipes need Git history.',
    };
  }

  let status: { stdout: string };
  try {
    status = await git(rootPath, ['status', '--short']);
  } catch (err) {
    return {
      id: 'git',
      label: 'Git',
      status: 'warn',
      summary: 'Git worktree detected, but status is unavailable.',
      detail: formatGitError(err),
      command: 'git status --short',
    };
  }

  const remote = await git(rootPath, ['remote']).catch((err) => err);
  const dirty = status.stdout.trim().length > 0;
  return {
    id: 'git',
    label: 'Git',
    status: dirty ? 'warn' : 'pass',
    summary: dirty ? 'Git worktree has local changes.' : 'Git worktree detected and clean.',
    detail: gitRemoteDetail(remote),
  };
}

function gitRemoteDetail(remote: { stdout: string } | unknown): string {
  if (isGitResult(remote)) {
    return remote.stdout.trim().length > 0
      ? `Remotes: ${remote.stdout.trim().split(/\s+/).join(', ')}`
      : 'No git remote configured.';
  }
  return `Remote metadata unavailable: ${formatGitError(remote)}`;
}

function isGitResult(value: unknown): value is { stdout: string } {
  return typeof value === 'object' && value !== null && 'stdout' in value && !('code' in value);
}

function formatGitError(err: unknown): string {
  return err instanceof Error ? err.message.trim() : String(err);
}

async function checkConfig(rootPath: string): Promise<FirstRunDiagnostic> {
  try {
    await fs.access(path.join(rootPath, '.projscanrc.json'));
    return {
      id: 'projscan-config',
      label: 'projscan config',
      status: 'pass',
      summary: 'Found .projscanrc.json.',
    };
  } catch {
    return {
      id: 'projscan-config',
      label: 'projscan config',
      status: 'info',
      summary: 'No .projscanrc.json yet; defaults are fine for first use.',
      command: 'projscan init',
    };
  }
}

async function checkTreeSitter(rootPath: string): Promise<FirstRunDiagnostic> {
  const candidates = [
    path.join(rootPath, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm'),
    path.join(rootPath, 'dist', 'grammars', 'web-tree-sitter.wasm'),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return {
        id: 'tree-sitter',
        label: 'Tree-sitter runtime',
        status: 'pass',
        summary: 'Tree-sitter WASM runtime is present.',
      };
    } catch {
      // try next
    }
  }
  return {
    id: 'tree-sitter',
    label: 'Tree-sitter runtime',
    status: 'info',
    summary: 'Tree-sitter runtime was not found in this project checkout.',
    detail: 'This is normal when using npx; projscan ships its runtime with the package.',
  };
}

async function checkPlugins(rootPath: string): Promise<FirstRunDiagnostic> {
  const entries = await discoverPluginManifests(rootPath);
  if (entries.length === 0) {
    return {
      id: 'plugins',
      label: 'Local plugins',
      status: 'info',
      summary: 'No local plugin manifests found.',
      detail: `Set ${PLUGIN_PREVIEW_FLAG}=1 only when you want projscan to execute trusted local plugins.`,
      command: 'projscan plugin init --kind analyzer --name policy',
    };
  }
  const broken = entries.filter((entry) => entry.manifest === null);
  return {
    id: 'plugins',
    label: 'Local plugins',
    status: broken.length > 0 ? 'warn' : 'pass',
    summary:
      broken.length > 0
        ? `${broken.length} of ${entries.length} plugin manifest(s) need attention.`
        : `${entries.length} plugin manifest(s) validate.`,
    command: 'projscan plugin list',
  };
}

function checkMcpStartup(): FirstRunDiagnostic {
  return {
    id: 'mcp-startup',
    label: 'MCP startup',
    status: 'pass',
    summary: 'Use stdio startup for every MCP client.',
    detail: INSTALL.mcpServerCommand,
    command: 'npx -y projscan mcp',
  };
}

function summarizeDiagnostics(diagnostics: FirstRunDiagnostic[]): FirstRunStatus {
  if (diagnostics.some((diagnostic) => diagnostic.status === 'fail')) return 'fail';
  if (diagnostics.some((diagnostic) => diagnostic.status === 'warn')) return 'warn';
  return 'pass';
}

function dedupeCommands(commands: string[]): string[] {
  return [...new Set(commands)];
}

async function git(rootPath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, {
    cwd: rootPath,
    timeout: 5000,
    maxBuffer: 1024 * 1024,
  });
}
