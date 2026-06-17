import type { FileEntry } from '../types.js';
import type { LanguageAdapter } from './languages/LanguageAdapter.js';
import { getAdapterFor } from './languages/registry.js';

const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;

export interface ParseableGraphInput {
  file: FileEntry;
  adapter: LanguageAdapter;
}

interface CandidateGraphInput {
  file: FileEntry;
  adapter: LanguageAdapter | undefined;
}

export function selectParseableGraphInputs(files: FileEntry[]): ParseableGraphInput[] {
  return files.map(toCandidateGraphInput).filter(isParseableGraphInput);
}

function toCandidateGraphInput(file: FileEntry): CandidateGraphInput {
  return {
    file,
    adapter: getAdapterFor(file.relativePath),
  };
}

function isParseableGraphInput(input: CandidateGraphInput): input is ParseableGraphInput {
  const { adapter } = input;
  return adapter !== undefined && input.file.sizeBytes <= maxFileSize(adapter);
}

function maxFileSize(adapter: LanguageAdapter): number {
  return adapter.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
}
