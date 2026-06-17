import type {
  FileExplanation,
  FileInspection,
} from '../types.js';
import { readProjectFile } from './fileAccess.js';
import { inspectExistingProjectFile, type InspectOptions } from './fileInspectionReport.js';

export { inferPurpose } from './filePurpose.js';
export { detectFileIssues } from './fileIssues.js';
export type { InspectOptions } from './fileInspectionReport.js';

export async function explainFile(
  rootPath: string,
  relOrAbsFile: string,
  options: InspectOptions = {},
): Promise<FileExplanation> {
  const inspection = await inspectFile(rootPath, relOrAbsFile, options);
  if (!inspection.exists) {
    throw new Error(inspection.reason ?? 'File not found');
  }
  return {
    filePath: inspection.relativePath,
    purpose: inspection.purpose,
    imports: inspection.imports,
    exports: inspection.exports,
    potentialIssues: inspection.potentialIssues,
    lineCount: inspection.lineCount,
  };
}

export async function inspectFile(
  rootPath: string,
  relOrAbsFile: string,
  options: InspectOptions = {},
): Promise<FileInspection> {
  const fileRead = await readProjectFile(rootPath, relOrAbsFile);
  if (!fileRead.ok) {
    return makeEmpty(fileRead.relativePath, fileRead.reason);
  }

  return inspectExistingProjectFile(fileRead.file, options);
}

function makeEmpty(relativePath: string, reason: string): FileInspection {
  return {
    relativePath,
    exists: false,
    reason,
    purpose: '',
    lineCount: 0,
    sizeBytes: 0,
    imports: [],
    exports: [],
    potentialIssues: [],
    hotspot: null,
    issues: [],
  };
}
