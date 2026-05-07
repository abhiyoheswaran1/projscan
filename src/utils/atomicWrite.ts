import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Crash-safe file write: write to a tmp path, fsync the data, rename
 * over the target, then best-effort fsync the parent directory.
 *
 * Three hardenings over a naive writeFile + rename:
 *
 *   1. Tmp filename uses randomUUID() so the path is unpredictable. A
 *      shared-system attacker can't pre-create a symlink at the tmp path
 *      before our write lands.
 *
 *   2. Open with the 'wx' flag (O_CREAT | O_EXCL). If the tmp path
 *      already exists for any reason (race, leftover, planted symlink),
 *      fs.open throws EEXIST instead of following the symlink. Belt-
 *      and-suspenders with #1.
 *
 *   3. fsync the file before rename, and best-effort fsync the parent
 *      dir after rename. Rename is atomic at the journal-record level
 *      on most filesystems, but without fsync the rename can survive a
 *      crash with empty tmp content (file metadata persists, data
 *      doesn't). Parent-dir sync is best-effort: Windows doesn't
 *      support it and some FUSE backends treat it as a no-op.
 *
 * Used by `applyFix` (1.6+) and `session.saveSession` (1.8+) to ensure
 * that crashes mid-write never leave partially-written state on disk.
 */
export async function atomicWriteFile(absPath: string, content: string): Promise<void> {
  const tmp = `${absPath}.projscan-tmp-${randomUUID()}`;
  const handle = await fs.open(tmp, 'wx');
  try {
    await handle.writeFile(content, 'utf-8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  // 1.8+ — clean up the tmp file if rename fails (e.g., the target is
  // on a read-only filesystem, EACCES, or its parent dir was removed
  // mid-write). Without this, retried writes leak abandoned tmp files
  // forever — invisible until they pile up. Re-throw the original
  // error so callers see the real cause; the unlink is best-effort.
  try {
    await fs.rename(tmp, absPath);
  } catch (err) {
    try {
      await fs.unlink(tmp);
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
  try {
    const dir = await fs.open(path.dirname(absPath), 'r');
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  } catch {
    // ignore — best-effort
  }
}
