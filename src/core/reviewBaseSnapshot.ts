import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildCodeGraph, type CodeGraph } from './codeGraph.js';
import { readManifests, type ManifestSnapshot } from './reviewManifests.js';
import { scanRepository } from './repositoryScanner.js';
import { gitFailureSummary, runReviewGit } from './reviewGit.js';

interface ReviewBaseSnapshot {
  graph: CodeGraph;
  packageManifests: Map<string, ManifestSnapshot>;
}

type ReviewBaseSnapshotResult =
  | ({ available: true } & ReviewBaseSnapshot)
  | { available: false; reason: string };

export async function buildReviewBaseSnapshot(
  rootPath: string,
  baseRef: string,
  baseSha: string,
): Promise<ReviewBaseSnapshotResult> {
  const worktreeDir = await mkTempWorktreeDir();
  try {
    // `--` separator before positional args. baseSha is verified through
    // `rev-parse --verify ... ^{commit}` upstream so it is already sha-shaped,
    // but the separator is defense-in-depth for future ref plumbing.
    const addWorktree = await runReviewGit(rootPath, [
      'worktree',
      'add',
      '--detach',
      '--',
      worktreeDir,
      baseSha,
    ]);
    if (addWorktree.code !== 0) {
      return {
        available: false,
        reason: `Could not check out base ref "${baseRef}" for review: ${gitFailureSummary(addWorktree)}`,
      };
    }
    const baseScan = await scanRepository(worktreeDir);
    const graph = await buildCodeGraph(worktreeDir, baseScan.files);
    const packageManifests = await readManifests(worktreeDir);
    return { available: true, graph, packageManifests };
  } finally {
    await runReviewGit(rootPath, ['worktree', 'remove', '--force', worktreeDir]).catch(() => {});
    await fs.rm(worktreeDir, { recursive: true, force: true }).catch(() => {});
  }
}

function mkTempWorktreeDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-review-'));
}
