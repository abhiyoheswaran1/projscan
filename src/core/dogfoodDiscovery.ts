import fs from 'node:fs/promises';
import path from 'node:path';

import type { DogfoodRepoDiscovery } from '../types/dogfood.js';

const MAX_DISCOVERY_DEPTH = 2;
const DISCOVERY_SKIP_DIRS = new Set([
  '.agentflight',
  '.agentloop',
  '.cache',
  '.git',
  '.next',
  '.turbo',
  '.worktrees',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

export async function resolveDogfoodRepos(
  rootPath: string,
  options: { repos?: string[]; discoverRoots?: string[] },
  targetRepoCount: number,
): Promise<{ repos: string[]; discovery?: DogfoodRepoDiscovery }> {
  const explicitRepos = normalizePaths(rootPath, options.repos ?? []);
  if (!options.discoverRoots || options.discoverRoots.length === 0) {
    return { repos: explicitRepos.length > 0 ? explicitRepos : [path.resolve(rootPath)] };
  }

  const roots = normalizePaths(rootPath, options.discoverRoots);
  const candidates = await discoverDogfoodCandidates(roots, rootPath);
  const selectedExtras = selectDiscoveredRepos(candidates, explicitRepos, rootPath, targetRepoCount);
  const selected = uniquePaths([...explicitRepos, ...selectedExtras]);
  const fallbackRepos = selected.length > 0 ? selected : [path.resolve(rootPath)];
  return {
    repos: fallbackRepos,
    discovery: {
      roots,
      candidates,
      selected: fallbackRepos,
      targetRepoCount,
      missingRepoCount: Math.max(0, targetRepoCount - fallbackRepos.length),
      command: dogfoodDiscoveryCommand(roots, targetRepoCount),
    },
  };
}

function normalizePaths(rootPath: string, values: string[]): string[] {
  return [...new Set(values.map((value) => path.resolve(rootPath, value)))];
}

async function discoverDogfoodCandidates(
  roots: string[],
  rootPath: string,
): Promise<string[]> {
  const candidates = new Set<string>();
  for (const root of roots) await collectDogfoodCandidates(root, candidates, 0);
  return orderDiscoveredRepos([...candidates], rootPath);
}

async function collectDogfoodCandidates(
  directory: string,
  candidates: Set<string>,
  depth: number,
): Promise<void> {
  if (depth > MAX_DISCOVERY_DEPTH) return;
  if (depth > 0 && shouldSkipDiscoveryDirectory(path.basename(directory))) return;
  if (await hasPackageJson(directory)) {
    candidates.add(directory);
    return;
  }
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || shouldSkipDiscoveryDirectory(entry.name)) continue;
    await collectDogfoodCandidates(path.join(directory, entry.name), candidates, depth + 1);
  }
}

async function hasPackageJson(directory: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path.join(directory, 'package.json'));
    return stat.isFile();
  } catch {
    return false;
  }
}

function shouldSkipDiscoveryDirectory(name: string): boolean {
  return DISCOVERY_SKIP_DIRS.has(name) || name.startsWith('.');
}

function selectDiscoveredRepos(
  candidates: string[],
  explicitRepos: string[],
  rootPath: string,
  targetRepoCount: number,
): string[] {
  const explicit = new Set(explicitRepos.map(normalizeMatchValue));
  const slots = Math.max(0, targetRepoCount - explicitRepos.length);
  return orderDiscoveredRepos(
    candidates.filter((candidate) => !explicit.has(normalizeMatchValue(candidate))),
    rootPath,
  ).slice(0, slots);
}

function orderDiscoveredRepos(repos: string[], rootPath: string): string[] {
  const normalizedRoot = normalizeMatchValue(path.resolve(rootPath));
  return uniquePaths(repos).sort((a, b) => {
    const rank = discoveryRank(a, normalizedRoot) - discoveryRank(b, normalizedRoot);
    return rank !== 0 ? rank : a.localeCompare(b);
  });
}

function discoveryRank(repoPath: string, normalizedRoot: string): number {
  return normalizeMatchValue(repoPath) === normalizedRoot ? 0 : 1;
}

function uniquePaths(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeMatchValue(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value);
  }
  return result;
}

function dogfoodDiscoveryCommand(roots: string[], targetRepoCount: number): string {
  return [
    'projscan dogfood',
    ...roots.map((root) => '--discover ' + shellQuote(root)),
    '--target-repos ' + targetRepoCount,
    '--format json',
  ].join(' ');
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function normalizeMatchValue(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/$/, '').trim().toLowerCase();
}
