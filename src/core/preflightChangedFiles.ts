import { getChangedFiles, type ChangedFilesResult } from '../utils/changedFiles.js';
import type { PreflightMode } from '../types.js';

export interface PreflightChangedFiles {
  available: boolean;
  count: number;
  files: string[];
  baseRef: string | null;
  branchChangedFileCount: number;
  uncommittedChangedFileCount: number;
  uncommittedFiles: string[];
  reason?: string;
}

export async function safeChangedFiles(
  rootPath: string,
  mode: PreflightMode,
  baseRef?: string,
): Promise<PreflightChangedFiles> {
  if (mode === 'before_edit') {
    return {
      available: false,
      count: 0,
      files: [],
      baseRef: null,
      branchChangedFileCount: 0,
      uncommittedChangedFileCount: 0,
      uncommittedFiles: [],
      reason: 'changed-file detection is not required before edits',
    };
  }
  try {
    return changedFilesFromResult(await getChangedFiles(rootPath, baseRef));
  } catch (err) {
    return {
      available: false,
      count: 0,
      files: [],
      baseRef: null,
      branchChangedFileCount: 0,
      uncommittedChangedFileCount: 0,
      uncommittedFiles: [],
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

function changedFilesFromResult(result: ChangedFilesResult): PreflightChangedFiles {
  return {
    available: result.available,
    count: result.files.length,
    files: result.files,
    baseRef: result.baseRef,
    branchChangedFileCount: branchChangedFileCount(result.files, result.uncommittedFiles),
    uncommittedChangedFileCount: result.uncommittedFiles.length,
    uncommittedFiles: result.uncommittedFiles,
    ...(result.reason ? { reason: result.reason } : {}),
  };
}

function branchChangedFileCount(files: string[], uncommittedFiles: string[]): number {
  const uncommitted = new Set(uncommittedFiles);
  return files.filter((file) => !uncommitted.has(file)).length;
}
