import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { scanRepository } from './repositoryScanner.js';
import { buildCodeGraph, importersOf } from './codeGraph.js';
import { getChangedFiles } from '../utils/changedFiles.js';

const execFileAsync = promisify(execFile);

/**
 * Swarm collision detection (4.x coordination arc).
 *
 * When several agents edit one repo in parallel — each in its own git worktree
 * — their changes collide if they touch the same file, or if one edits a file
 * the other's change depends on. This surfaces those overlaps BEFORE the
 * branches are merged, using the existing import graph for blast radius.
 *
 * Strictly local-first: it reads the repo's own `git worktree list` (same
 * machine, same repo) and never reaches the network or a coordination server.
 */

export interface WorktreeRef {
  /** Absolute worktree path. */
  path: string;
  /** Branch name (no refs/heads/ prefix), or null when detached. */
  branch: string | null;
  /** HEAD commit sha, or null. */
  head: string | null;
}

export type CollisionKind = 'same-file' | 'dependency';

export interface Collision {
  kind: CollisionKind;
  severity: 'high' | 'medium';
  worktreeA: string;
  fileA: string;
  worktreeB: string;
  fileB: string;
  reason: string;
}

export interface CollisionWorktreeSummary {
  path: string;
  branch: string | null;
  changedFileCount: number;
  baseRef: string | null;
}

export interface CollisionReport {
  schemaVersion: 1;
  available: boolean;
  reason?: string;
  worktrees: CollisionWorktreeSummary[];
  collisions: Collision[];
}

export interface DetectCollisionsOptions {
  /** Base ref each worktree is diffed against. Defaults to the usual fallbacks. */
  baseRef?: string;
}

/** Parse `git worktree list --porcelain` into structured refs. Local-first. */
export async function listWorktrees(rootPath: string): Promise<WorktreeRef[]> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
      cwd: rootPath,
      maxBuffer: 8 * 1024 * 1024,
    }));
  } catch {
    return [];
  }

  const refs: WorktreeRef[] = [];
  let current: WorktreeRef | null = null;
  const flush = (): void => {
    if (current) refs.push(current);
    current = null;
  };
  for (const line of stdout.split('\n')) {
    if (line.startsWith('worktree ')) {
      flush();
      current = { path: line.slice('worktree '.length).trim(), branch: null, head: null };
    } else if (current && line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length).trim();
    } else if (current && line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).trim().replace(/^refs\/heads\//, '');
    } else if (current && line.trim() === 'detached') {
      current.branch = null;
    } else if (line.trim() === '') {
      flush();
    }
  }
  flush();
  return refs;
}

/**
 * Detect collisions across the repo's in-flight worktrees. Needs at least two
 * worktrees (otherwise there's nothing to coordinate). The dependency edges
 * come from the current repo's import graph (HEAD); a file added only inside a
 * worktree simply has no edges yet and is still caught by same-file overlap.
 */
export async function detectCollisions(
  rootPath: string,
  options: DetectCollisionsOptions = {},
): Promise<CollisionReport> {
  const worktrees = await listWorktrees(rootPath);

  if (worktrees.length < 2) {
    return {
      schemaVersion: 1,
      available: false,
      reason:
        worktrees.length === 0
          ? 'not a git repository, or git worktrees are unavailable'
          : 'only one worktree — collision detection needs at least two in-flight worktrees',
      worktrees: worktrees.map((w) => ({ path: w.path, branch: w.branch, changedFileCount: 0, baseRef: null })),
      collisions: [],
    };
  }

  // Changed files per worktree (repo-relative, POSIX).
  const changes = await Promise.all(
    worktrees.map(async (w) => {
      const result = await getChangedFiles(w.path, options.baseRef);
      return {
        ref: w,
        files: result.available ? result.files : [],
        baseRef: result.baseRef,
      };
    }),
  );

  // Import graph of the current repo for dependency (blast-radius) edges.
  const scan = await scanRepository(rootPath);
  const graph = await buildCodeGraph(rootPath, scan.files);

  const collisions: Collision[] = [];
  for (let i = 0; i < changes.length; i++) {
    for (let j = i + 1; j < changes.length; j++) {
      const a = changes[i];
      const b = changes[j];
      const aFiles = a.files;
      const bSet = new Set(b.files);
      const aSet = new Set(a.files);

      // Same-file overlap — both worktrees changed the same file.
      for (const file of aFiles) {
        if (bSet.has(file)) {
          collisions.push({
            kind: 'same-file',
            severity: 'high',
            worktreeA: a.ref.path,
            fileA: file,
            worktreeB: b.ref.path,
            fileB: file,
            reason: `Both worktrees changed ${file}.`,
          });
        }
      }

      // Dependency overlap — one worktree changed a file the other's change
      // imports (1-hop import edge). Skip files already flagged same-file.
      for (const file of aFiles) {
        if (bSet.has(file)) continue;
        const importers = new Set(importersOf(graph, file));
        for (const other of b.files) {
          if (other === file || aSet.has(other)) continue;
          if (importers.has(other)) {
            collisions.push({
              kind: 'dependency',
              severity: 'medium',
              worktreeA: a.ref.path,
              fileA: file,
              worktreeB: b.ref.path,
              fileB: other,
              reason: `${other} (changed in the other worktree) imports ${file} (changed here).`,
            });
          }
        }
      }
      for (const file of b.files) {
        if (aSet.has(file)) continue;
        const importers = new Set(importersOf(graph, file));
        for (const other of aFiles) {
          if (other === file || bSet.has(other)) continue;
          if (importers.has(other)) {
            collisions.push({
              kind: 'dependency',
              severity: 'medium',
              worktreeA: a.ref.path,
              fileA: other,
              worktreeB: b.ref.path,
              fileB: file,
              reason: `${other} (changed here) imports ${file} (changed in the other worktree).`,
            });
          }
        }
      }
    }
  }

  return {
    schemaVersion: 1,
    available: true,
    worktrees: changes.map((c) => ({
      path: c.ref.path,
      branch: c.ref.branch,
      changedFileCount: c.files.length,
      baseRef: c.baseRef,
    })),
    collisions,
  };
}
