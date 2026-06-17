import type { CodeGraph } from './codeGraph.js';
import { detectWorkspaces, filterFilesByPackage } from './monorepo.js';
import type { PrDiffReport } from '../types/prDiff.js';

export async function resolvePackageScopeFiles(
  rootPath: string,
  graph: CodeGraph,
  packageName: string | undefined,
): Promise<Set<string> | undefined> {
  if (!packageName) return undefined;
  const workspaces = await detectWorkspaces(rootPath);
  return new Set(filterFilesByPackage(workspaces, packageName, [...graph.files.keys()]));
}

export async function scopePrDiffToPackage(
  rootPath: string,
  prDiff: PrDiffReport,
  packageName: string | undefined,
): Promise<void> {
  if (!packageName) return;
  const workspaces = await detectWorkspaces(rootPath);
  const allChangedPaths = [
    ...prDiff.filesAdded,
    ...prDiff.filesRemoved,
    ...prDiff.filesModified.map((file) => file.relativePath),
  ];
  const allowed = new Set(filterFilesByPackage(workspaces, packageName, allChangedPaths));
  prDiff.filesAdded = prDiff.filesAdded.filter((file) => allowed.has(file));
  prDiff.filesRemoved = prDiff.filesRemoved.filter((file) => allowed.has(file));
  prDiff.filesModified = prDiff.filesModified.filter((file) => allowed.has(file.relativePath));
  prDiff.totalFilesChanged =
    prDiff.filesAdded.length + prDiff.filesRemoved.length + prDiff.filesModified.length;
}
