import chalk from 'chalk';
import { getChangedFiles, type ChangedFilesResult } from '../utils/changedFiles.js';
import type { ReportFormat } from '../types/config.js';
import type { Issue } from '../types.js';
import {
  changedFilesAvailableMessage,
  changedFilesUnavailableMessage,
  changedIssueFilterMessage,
  filterIssuesToChangedFiles,
} from './changedIssueFilter.js';

type ChangedFilesLoader = (
  rootPath: string,
  explicitBaseRef?: string,
) => Promise<ChangedFilesResult>;
type NoticeWriter = (message: string) => void;

export interface ChangedOnlyFilterOptions {
  issues: Issue[];
  rootPath: string;
  baseRef?: string;
  format: ReportFormat;
  quiet: boolean;
  getChangedFiles?: ChangedFilesLoader;
  write?: NoticeWriter;
}

export async function filterIssuesByChangedFilesForCli(
  options: ChangedOnlyFilterOptions,
): Promise<Issue[]> {
  const loadChangedFiles = options.getChangedFiles ?? getChangedFiles;
  const result = await loadChangedFiles(options.rootPath, options.baseRef);
  if (!result.available) {
    writeChangedOnlyNotice(
      changedFilesUnavailableMessage(result.reason),
      options.format,
      options.quiet,
      'warning',
      options.write,
    );
    return options.issues;
  }

  writeChangedOnlyNotice(
    changedFilesAvailableMessage(result.baseRef, result.files.length),
    options.format,
    options.quiet,
    'dim',
    options.write,
  );
  const filtered = filterIssuesToChangedFiles(options.issues, result.files);
  const filterMessage = changedIssueFilterMessage(filtered);
  if (filterMessage) {
    writeChangedOnlyNotice(filterMessage, options.format, options.quiet, 'dim', options.write);
  }
  return filtered.issues;
}

function writeChangedOnlyNotice(
  message: string,
  format: ReportFormat,
  quiet: boolean,
  style: 'dim' | 'warning',
  write: NoticeWriter = console.error,
): void {
  if (quiet) return;
  if (format !== 'console') {
    write(message.trim());
    return;
  }
  write(style === 'warning' ? chalk.yellow(message) : chalk.dim(message));
}
