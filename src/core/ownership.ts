import fs from 'node:fs/promises';
import path from 'node:path';
import { detectWorkspaces } from './monorepo.js';

export type OwnershipLookup = (relativePath: string) => string | undefined;

interface OwnershipRule {
  pattern: string;
  owner: string;
  matcher: RegExp;
  basenameOnly: boolean;
  directoryPrefix?: string;
}

const CODEOWNERS_CANDIDATES = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'];

export async function loadOwnership(rootPath: string): Promise<OwnershipLookup | undefined> {
  const packageLookup = await loadPackageOwnership(rootPath);
  const codeownersLookup = await loadCodeownersOwnership(rootPath);
  if (!packageLookup) return codeownersLookup;
  if (!codeownersLookup) return packageLookup;
  return (relativePath: string) => codeownersLookup(relativePath) ?? packageLookup(relativePath);
}

async function loadCodeownersOwnership(rootPath: string): Promise<OwnershipLookup | undefined> {
  for (const candidate of CODEOWNERS_CANDIDATES) {
    try {
      const content = await fs.readFile(path.join(rootPath, candidate), 'utf-8');
      return createOwnershipLookup(content);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      if (code !== 'ENOENT') return undefined;
    }
  }
  return undefined;
}

async function loadPackageOwnership(rootPath: string): Promise<OwnershipLookup | undefined> {
  const workspaces = await detectWorkspaces(rootPath);
  const rules: Array<{ prefix: string; owner: string }> = [];
  for (const pkg of workspaces.packages) {
    const owner = await readPackageOwner(path.join(rootPath, pkg.relativePath, 'package.json'));
    if (!owner) continue;
    rules.push({ prefix: normalizePath(pkg.relativePath), owner });
  }
  if (rules.length === 0) return undefined;
  rules.sort((a, b) => b.prefix.length - a.prefix.length);
  return (relativePath: string) => {
    const normalized = normalizePath(relativePath);
    for (const rule of rules) {
      if (rule.prefix === '') return rule.owner;
      if (normalized === rule.prefix || normalized.startsWith(`${rule.prefix}/`)) return rule.owner;
    }
    return undefined;
  };
}

async function readPackageOwner(packageJsonPath: string): Promise<string | undefined> {
  let raw: string;
  try {
    raw = await fs.readFile(packageJsonPath, 'utf-8');
  } catch {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as {
      owner?: unknown;
      owners?: unknown;
      projscan?: { owner?: unknown; owners?: unknown };
    };
    return normalizeOwnerValue(
      parsed.projscan?.owner ?? parsed.projscan?.owners ?? parsed.owner ?? parsed.owners,
    );
  } catch {
    return undefined;
  }
}

function normalizeOwnerValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (Array.isArray(value)) {
    const owners = value.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
    return owners.length > 0 ? owners.map((owner) => owner.trim()).join(' ') : undefined;
  }
  return undefined;
}

export function createOwnershipLookup(content: string): OwnershipLookup {
  const rules = parseOwnershipRules(content);
  return (relativePath: string) => {
    const normalizedPath = normalizePath(relativePath);
    let owner: string | undefined;
    for (const rule of rules) {
      if (matchesRule(rule, normalizedPath)) owner = rule.owner;
    }
    return owner;
  };
}

function parseOwnershipRules(content: string): OwnershipRule[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 2)
    .map(([rawPattern, ...owners]) => buildRule(rawPattern, owners.join(' ')))
    .filter((rule): rule is OwnershipRule => rule !== null);
}

function buildRule(rawPattern: string | undefined, owner: string): OwnershipRule | null {
  if (!rawPattern || owner.length === 0) return null;
  const pattern = normalizePattern(rawPattern);
  if (!pattern) return null;

  if (pattern.endsWith('/')) {
    return {
      pattern,
      owner,
      matcher: /^$/,
      basenameOnly: false,
      directoryPrefix: pattern,
    };
  }

  return {
    pattern,
    owner,
    matcher: wildcardToRegExp(pattern),
    basenameOnly: !pattern.includes('/'),
  };
}

function matchesRule(rule: OwnershipRule, relativePath: string): boolean {
  if (rule.directoryPrefix) return relativePath.startsWith(rule.directoryPrefix);
  if (rule.basenameOnly) {
    const base = relativePath.split('/').pop() ?? relativePath;
    return rule.matcher.test(base);
  }
  return rule.matcher.test(relativePath);
}

function normalizePattern(pattern: string): string {
  return normalizePath(pattern.replace(/^\/+/, ''));
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`);
}
