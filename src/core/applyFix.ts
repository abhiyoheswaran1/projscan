import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { atomicWriteFile } from '../utils/atomicWrite.js';

/**
 * Apply layer (1.6+).
 *
 * Closes the diagnose → suggest → apply loop. Today projscan tells
 * agents what to do; the apply layer lets it actually do (small,
 * safe, mechanical) changes — with explicit confirmation.
 *
 * Design constraints:
 *   - Dry-run by default. The MCP tool surface defaults `confirm:false`
 *     and never writes without an explicit `confirm:true`.
 *   - Atomic writes (write-to-tmp + rename). Partial state on disk is
 *     not allowed even on crash mid-write.
 *   - Rollback. Every applied change records (file, beforeHash,
 *     beforeContent, afterHash, op) under .projscan-cache/rollbacks/
 *     <rollbackId>.json so the user can `projscan apply rollback <id>`.
 *   - Mechanical only. Apply support is opt-in per template — no
 *     codemods, no semantic rename, no AI inference. If a template
 *     doesn't declare an apply function, we surface "not applicable
 *     for auto-apply" rather than guessing.
 */

const ROLLBACK_DIR = '.projscan-cache/rollbacks';

export type ApplyOp = 'create' | 'modify' | 'delete';

export interface ApplyChange {
  /** Repo-relative target path (POSIX-separator). */
  path: string;
  op: ApplyOp;
  /** SHA-256 of file content before the change. null when op='create'. */
  beforeHash: string | null;
  /** SHA-256 of file content after the change. null when op='delete'. */
  afterHash: string | null;
  /**
   * Snapshot of the before-content. Stored in the rollback record so
   * the original can be restored even after the file has been further
   * edited. null when op='create'.
   */
  beforeContent?: string | null;
  /**
   * Repo-relative parent dirs that did not exist before the forward
   * `op:'create'` ran and were brought into being by its `mkdir -p`. On
   * rollback the unlink removes the file; these dirs are then `rmdir`'d
   * deepest-first (silently no-op if non-empty, so unrelated siblings
   * survive). Absent for op:'modify' and op:'delete' and for older
   * rollback records written before this field existed.
   */
  createdParentDirs?: string[];
}

export interface ApplyResult {
  ok: boolean;
  /** Set when ok=false. */
  reason?: string;
  /** Whether disk was actually written. False for dry runs. */
  applied: boolean;
  /** Rollback id (uuid). Present only when applied=true. */
  rollbackId?: string;
  changes: ApplyChange[];
}

/** A planned mutation: one or more file edits the template proposes. */
export interface ApplyPlan {
  changes: Array<{
    path: string;
    op: ApplyOp;
    /** New content. Required for 'create' / 'modify'; ignored for 'delete'. */
    content?: string;
  }>;
  /** Human-readable summary, surfaced in dry-run + confirmation UX. */
  summary: string;
}

export interface ApplyOptions {
  /** When true, never write to disk; return the would-be ApplyResult. */
  dryRun?: boolean;
}

/**
 * Execute an ApplyPlan against `rootPath`. Validates each path, hashes
 * before+after, performs atomic writes (tmp + rename), and records a
 * rollback file when applied=true.
 */
export async function executePlan(
  rootPath: string,
  plan: ApplyPlan,
  options: ApplyOptions = {},
): Promise<ApplyResult> {
  const dryRun = options.dryRun === true;
  const changes: ApplyChange[] = [];
  // Phase 1: validate + hash. No disk writes.
  for (const item of plan.changes) {
    if (!isSafeRelativePath(item.path)) {
      return {
        ok: false,
        applied: false,
        reason: `Refused unsafe target path "${item.path}". Apply targets must be repo-relative; absolute paths and ".." segments are rejected.`,
        changes: [],
      };
    }
    const abs = path.join(rootPath, item.path);
    const before = await readIfExists(abs);
    if (item.op === 'create' && before !== null) {
      return {
        ok: false,
        applied: false,
        reason: `Refused to create "${item.path}": file already exists. Use op:'modify' for in-place edits.`,
        changes: [],
      };
    }
    if ((item.op === 'modify' || item.op === 'delete') && before === null) {
      return {
        ok: false,
        applied: false,
        reason: `Refused to ${item.op} "${item.path}": file does not exist.`,
        changes: [],
      };
    }
    const beforeHash = before === null ? null : sha256(before);
    const afterHash =
      item.op === 'delete' ? null : sha256(item.content ?? '');
    changes.push({
      path: item.path,
      op: item.op,
      beforeHash,
      afterHash,
      ...(before !== null ? { beforeContent: before } : {}),
    });
  }

  if (dryRun) {
    return { ok: true, applied: false, changes };
  }

  // Phase 2: atomic apply. Write all 'create'/'modify' to tmp + rename
  // and unlink for 'delete'. If any write fails, we attempt to roll
  // back the previously-applied ones using the captured beforeContent.
  const completedIdx: number[] = [];
  for (let i = 0; i < changes.length; i++) {
    const item = plan.changes[i];
    const abs = path.join(rootPath, item.path);
    try {
      if (item.op === 'delete') {
        await fs.unlink(abs);
      } else {
        // 1.10+ — record which parent dirs we're about to bring into
        // existence on `op:'create'`, so the rollback can `rmdir` them
        // and leave the tree as we found it. We don't track this for
        // `op:'modify'` because by Phase-1 invariant the file (and
        // therefore its parent dir) already existed.
        let createdDirs: string[] = [];
        if (item.op === 'create') {
          createdDirs = await findMissingAncestors(abs, rootPath);
        }
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await atomicWrite(abs, item.content ?? '');
        if (createdDirs.length > 0) {
          changes[i].createdParentDirs = createdDirs.map((d) =>
            path.relative(rootPath, d).split(path.sep).join('/'),
          );
        }
      }
      completedIdx.push(i);
    } catch (err) {
      // Roll back what we already did. Spread-and-reverse to avoid mutating
      // `completedIdx` in place — the array is only iterated once today, but
      // an in-place mutation is a footgun if a future maintainer adds a
      // second iteration after this catch.
      for (const idx of [...completedIdx].reverse()) {
        const c = changes[idx];
        const cabs = path.join(rootPath, c.path);
        try {
          if (c.op === 'create') {
            await fs.unlink(cabs).catch(() => undefined);
            await removeCreatedParentDirs(rootPath, c.createdParentDirs);
          } else if (c.op === 'modify' && c.beforeContent !== undefined) {
            await atomicWrite(cabs, c.beforeContent ?? '');
          } else if (c.op === 'delete' && c.beforeContent !== undefined) {
            // 1.10+ — defensive mkdir before re-creating. The forward delete
            // only removed the file, but the parent dir may have been pruned
            // externally between apply and rollback. Without this, atomicWrite's
            // fs.open(tmp, 'wx') would ENOENT and the rollback would partial-fail.
            await fs.mkdir(path.dirname(cabs), { recursive: true });
            await atomicWrite(cabs, c.beforeContent ?? '');
          }
        } catch {
          // best-effort rollback
        }
      }
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        applied: false,
        reason: `Apply failed at "${item.path}" (${msg}). All earlier changes were rolled back.`,
        changes: [],
      };
    }
  }

  // Phase 3: record rollback artifact.
  const rollbackId = randomUUID();
  await writeRollbackRecord(rootPath, rollbackId, plan.summary, changes);
  return { ok: true, applied: true, rollbackId, changes };
}

/**
 * Reverse a previously-applied ApplyResult. Reads the rollback record,
 * restores each file's beforeContent (or deletes the file if op='create').
 */
export async function rollback(rootPath: string, rollbackId: string): Promise<ApplyResult> {
  const record = await readRollbackRecord(rootPath, rollbackId);
  if (!record) {
    return {
      ok: false,
      applied: false,
      reason: `No rollback record for id "${rollbackId}".`,
      changes: [],
    };
  }
  const reversed: ApplyChange[] = [];
  for (const c of record.changes) {
    if (!isSafeRelativePath(c.path)) continue;
    const abs = path.join(rootPath, c.path);
    try {
      if (c.op === 'create') {
        await fs.unlink(abs).catch(() => undefined);
        await removeCreatedParentDirs(rootPath, c.createdParentDirs);
        reversed.push({ ...c, op: 'delete', afterHash: null });
      } else if (c.op === 'modify' && c.beforeContent !== undefined) {
        await atomicWrite(abs, c.beforeContent ?? '');
        reversed.push({ ...c, op: 'modify' });
      } else if (c.op === 'delete' && c.beforeContent !== undefined) {
        // 1.10+ — defensive mkdir before re-creating: the forward delete only
        // removed the file, but a separate process may have pruned the
        // now-empty parent dir between apply and rollback.
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await atomicWrite(abs, c.beforeContent ?? '');
        reversed.push({ ...c, op: 'create', beforeHash: null });
      }
    } catch {
      // best-effort
    }
  }
  return { ok: true, applied: true, changes: reversed };
}

/**
 * Walk upward from `absPath`'s parent and collect the absolute paths of
 * ancestor dirs that do not yet exist (deepest-first). Stops at
 * `rootPath` — we never report rootPath itself or anything above it, so
 * a later `rmdir` pass can't accidentally tear down the project root or
 * directories outside the project. Returns [] when every ancestor down
 * to (and including) the file's parent already exists.
 */
async function findMissingAncestors(absPath: string, rootPath: string): Promise<string[]> {
  const root = path.resolve(rootPath);
  const missing: string[] = [];
  let cur = path.dirname(absPath);
  while (true) {
    const resolved = path.resolve(cur);
    if (resolved === root || !resolved.startsWith(root + path.sep)) break;
    try {
      await fs.access(resolved);
      break;
    } catch {
      missing.push(resolved);
      cur = path.dirname(resolved);
    }
  }
  return missing;
}

/**
 * Best-effort rmdir of dirs we created during forward apply. Deepest-first
 * (the list was collected deepest-first by findMissingAncestors). `rmdir`
 * refuses non-empty dirs by default, so if the user later wrote a sibling
 * file under one of these dirs, the rmdir silently no-ops and the
 * sibling survives.
 */
async function removeCreatedParentDirs(rootPath: string, rels: string[] | undefined): Promise<void> {
  if (!rels || rels.length === 0) return;
  for (const rel of rels) {
    if (!isSafeRelativePath(rel)) continue;
    try {
      await fs.rmdir(path.join(rootPath, rel));
    } catch {
      // best-effort: non-empty dir, race with another process, etc.
    }
  }
}

function isSafeRelativePath(p: string): boolean {
  if (typeof p !== 'string' || p.length === 0) return false;
  if (path.isAbsolute(p)) return false;
  if (p.split(/[/\\]/).some((seg) => seg === '..')) return false;
  return true;
}

async function readIfExists(absPath: string): Promise<string | null> {
  try {
    return await fs.readFile(absPath, 'utf-8');
  } catch {
    return null;
  }
}

// 1.8+ — atomic-write logic moved to src/utils/atomicWrite.ts and reused
// by session.saveSession. This file keeps the local name as a thin alias
// so existing call sites don't change shape.
const atomicWrite = atomicWriteFile;

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

async function writeRollbackRecord(
  rootPath: string,
  rollbackId: string,
  summary: string,
  changes: ApplyChange[],
): Promise<void> {
  try {
    const dir = path.join(rootPath, ROLLBACK_DIR);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${rollbackId}.json`);
    const record = {
      schemaVersion: 1,
      rollbackId,
      createdAt: new Date().toISOString(),
      summary,
      changes,
    };
    // 1.9+ — atomic write. The rollback record IS the recovery oracle;
    // a crash mid-write would otherwise leave a corrupt JSON that
    // `rollback` parses as null, stranding the user with applied
    // changes and no way to revert. Atomic rename guarantees the file
    // either contains the full record or doesn't exist.
    await atomicWriteFile(filePath, JSON.stringify(record, null, 2));
  } catch {
    // best-effort
  }
}

interface RollbackRecord {
  schemaVersion: number;
  rollbackId: string;
  createdAt: string;
  summary: string;
  changes: ApplyChange[];
}

// Rollback ids are crypto.randomUUID() outputs (always v4) — validate strict
// UUID v4 shape before joining into a path. Without this, a hostile
// `rollback_id` like `../../foo` from an MCP client reads arbitrary `.json`
// under cwd through path.join (the relative segments collapse during resolve).
// We only generate v4, so the regex pins the version digit to `4` (not the
// permissive `[1-5]` you'd see in generic UUID validators).
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readRollbackRecord(
  rootPath: string,
  rollbackId: string,
): Promise<RollbackRecord | null> {
  if (!UUID_V4_RE.test(rollbackId)) return null;
  try {
    const filePath = path.join(rootPath, ROLLBACK_DIR, `${rollbackId}.json`);
    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as RollbackRecord;
    if (parsed.schemaVersion !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}
