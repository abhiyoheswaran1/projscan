import { getChangedFiles, type ChangedFilesResult } from '../utils/changedFiles.js';
import type { PreflightMode } from '../types.js';

export interface PreflightChangedFiles {
  available: boolean;
  count: number;
  files: string[];
  baseRef: string | null;
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
    ...(result.reason ? { reason: result.reason } : {}),
  };
}
