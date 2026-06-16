import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile } from '../utils/atomicWrite.js';

const execFileAsync = promisify(execFile);

/**
 * Swarm claims / leases (4.x coordination arc).
 *
 * An agent can claim a file, directory, or symbol so the rest of the swarm sees
 * who is working where. Claims are advisory (not a hard lock) — claiming an
 * already-claimed target still succeeds, but returns the contending claims so
 * the agent can coordinate.
 *
 * The store is shared across all git worktrees of the repo: it lives under the
 * **git common dir** (`git rev-parse --git-common-dir`), not the per-worktree
 * `.projscan-cache`, because two agents coordinating are in different worktrees
 * of the same repo. Strictly local-first — no network, no server.
 */

export interface Claim {
  id: string;
  /** Claimed target: a repo-relative file/dir path, or a symbol name. */
  target: string;
  /** Who holds the claim. */
  agent: string;
  note?: string;
  /** ISO timestamp. */
  claimedAt: string;
  /** ISO expiry (lease). Absent = never expires. */
  expiresAt?: string;
}

export interface AddClaimResult {
  claim: Claim;
  /** Existing claims by OTHER agents whose target overlaps this one. */
  contention: Claim[];
}

interface ClaimStore {
  schemaVersion: 1;
  claims: Claim[];
}

async function claimStorePath(rootPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--git-common-dir'], {
      cwd: rootPath,
    });
    // --git-common-dir is the SAME directory for every worktree of the repo, so
    // the claim store is shared across the swarm. It may be relative to cwd.
    return path.join(path.resolve(rootPath, stdout.trim()), 'projscan', 'claims.json');
  } catch {
    // Not a git repo — fall back to the local cache (single-worktree only).
    return path.join(rootPath, '.projscan-cache', 'claims.json');
  }
}

/** Normalize a target for comparison: POSIX separators, no trailing slash. */
function normalizeTarget(target: string): string {
  const t = target.trim().split('\\').join('/');
  return t.endsWith('/') && t.length > 1 ? t.slice(0, -1) : t;
}

/** Two targets overlap if equal, or one is a directory ancestor of the other. */
export function claimTargetsOverlap(a: string, b: string): boolean {
  const na = normalizeTarget(a);
  const nb = normalizeTarget(b);
  if (na === nb) return true;
  return nb.startsWith(`${na}/`) || na.startsWith(`${nb}/`);
}

/** Claims held by more than one agent on overlapping targets (contention). */
export function findContendedClaims(claims: Claim[]): Claim[] {
  const contended = new Set<Claim>();
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      if (
        claims[i].agent !== claims[j].agent &&
        claimTargetsOverlap(claims[i].target, claims[j].target)
      ) {
        contended.add(claims[i]);
        contended.add(claims[j]);
      }
    }
  }
  return [...contended];
}

function isWellShapedClaim(value: unknown): value is Claim {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.target === 'string' &&
    typeof c.agent === 'string' &&
    typeof c.claimedAt === 'string'
  );
}

async function readStore(rootPath: string): Promise<ClaimStore> {
  try {
    const raw = await fs.readFile(await claimStorePath(rootPath), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ClaimStore>;
    const claims = Array.isArray(parsed.claims) ? parsed.claims.filter(isWellShapedClaim) : [];
    return { schemaVersion: 1, claims };
  } catch {
    return { schemaVersion: 1, claims: [] };
  }
}

async function writeStore(rootPath: string, store: ClaimStore): Promise<void> {
  const file = await claimStorePath(rootPath);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await atomicWriteFile(file, JSON.stringify(store, null, 2) + '\n');
}

/** All active claims, shared across the repo's worktrees. */
export async function listClaims(rootPath: string): Promise<Claim[]> {
  return (await readStore(rootPath)).claims;
}

/**
 * Record a claim. Returns the new claim plus any contending claims (held by a
 * different agent on an overlapping target). The claim is recorded regardless —
 * it's advisory; contention is surfaced for the agent to act on.
 */
export async function addClaim(
  rootPath: string,
  input: { target: string; agent: string; note?: string; ttlSeconds?: number },
  now: () => Date = () => new Date(),
): Promise<AddClaimResult> {
  const target = normalizeTarget(input.target);
  const at = now();
  const store = await readStore(rootPath);
  // Only ACTIVE claims (not expired leases) by a different agent contend.
  const contention = store.claims.filter(
    (c) => c.agent !== input.agent && isClaimActive(c, at) && claimTargetsOverlap(c.target, target),
  );
  const claim: Claim = {
    id: randomUUID(),
    target,
    agent: input.agent,
    ...(input.note ? { note: input.note } : {}),
    claimedAt: at.toISOString(),
    ...(input.ttlSeconds && input.ttlSeconds > 0
      ? { expiresAt: new Date(at.getTime() + input.ttlSeconds * 1000).toISOString() }
      : {}),
  };
  store.claims.push(claim);
  await writeStore(rootPath, store);
  return { claim, contention };
}

/** A claim is active unless its lease (expiresAt) has passed. No expiry = active. */
export function isClaimActive(claim: Claim, now: Date = new Date()): boolean {
  if (!claim.expiresAt) return true;
  return new Date(claim.expiresAt).getTime() > now.getTime();
}

/** Remove expired-lease claims. Returns the claims that were pruned. */
export async function pruneClaims(rootPath: string, now: Date = new Date()): Promise<Claim[]> {
  const store = await readStore(rootPath);
  const pruned = store.claims.filter((c) => !isClaimActive(c, now));
  if (pruned.length === 0) return [];
  store.claims = store.claims.filter((c) => isClaimActive(c, now));
  await writeStore(rootPath, store);
  return pruned;
}

/**
 * Release claims by id, by target (optionally scoped to an agent), or all of an
 * agent's claims. Returns the claims that were removed.
 */
export async function releaseClaim(
  rootPath: string,
  selector: { id?: string; target?: string; agent?: string },
): Promise<Claim[]> {
  const store = await readStore(rootPath);
  const target = selector.target !== undefined ? normalizeTarget(selector.target) : undefined;
  const matches = (c: Claim): boolean => {
    if (selector.id !== undefined) return c.id === selector.id;
    if (target !== undefined)
      return c.target === target && (selector.agent === undefined || c.agent === selector.agent);
    if (selector.agent !== undefined) return c.agent === selector.agent;
    return false;
  };
  const removed = store.claims.filter(matches);
  if (removed.length === 0) return [];
  store.claims = store.claims.filter((c) => !matches(c));
  await writeStore(rootPath, store);
  return removed;
}
