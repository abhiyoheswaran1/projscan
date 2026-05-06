import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

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
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await atomicWrite(abs, item.content ?? '');
      }
      completedIdx.push(i);
    } catch (err) {
      // Roll back what we already did.
      for (const idx of completedIdx.reverse()) {
        const c = changes[idx];
        const cabs = path.join(rootPath, c.path);
        try {
          if (c.op === 'create') {
            await fs.unlink(cabs).catch(() => undefined);
          } else if (c.op === 'modify' && c.beforeContent !== undefined) {
            await atomicWrite(cabs, c.beforeContent ?? '');
          } else if (c.op === 'delete' && c.beforeContent !== undefined) {
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
        reversed.push({ ...c, op: 'delete', afterHash: null });
      } else if (c.op === 'modify' && c.beforeContent !== undefined) {
        await atomicWrite(abs, c.beforeContent ?? '');
        reversed.push({ ...c, op: 'modify' });
      } else if (c.op === 'delete' && c.beforeContent !== undefined) {
        await atomicWrite(abs, c.beforeContent ?? '');
        reversed.push({ ...c, op: 'create', beforeHash: null });
      }
    } catch {
      // best-effort
    }
  }
  return { ok: true, applied: true, changes: reversed };
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

async function atomicWrite(absPath: string, content: string): Promise<void> {
  const tmp = `${absPath}.projscan-tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, content, 'utf-8');
  await fs.rename(tmp, absPath);
}

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
    await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
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

async function readRollbackRecord(
  rootPath: string,
  rollbackId: string,
): Promise<RollbackRecord | null> {
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
