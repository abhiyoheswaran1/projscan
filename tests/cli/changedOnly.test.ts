import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { ReportFormat } from '../../src/types/config.js';
import type { Issue } from '../../src/types.js';
import type { ChangedFilesResult } from '../../src/utils/changedFiles.js';

type ChangedOnlyHelper = {
  filterIssuesByChangedFilesForCli(options: {
    issues: Issue[];
    rootPath: string;
    baseRef?: string;
    format: ReportFormat;
    quiet: boolean;
    getChangedFiles?: (
      rootPath: string,
      explicitBaseRef?: string,
    ) => Promise<ChangedFilesResult>;
    write?: (message: string) => void;
  }): Promise<Issue[]>;
};

describe('CLI changed-only orchestration', () => {
  it('keeps changed-only orchestration out of the shared CLI module', () => {
    const sharedSource = fs.readFileSync(path.join(process.cwd(), 'src/cli/_shared.ts'), 'utf8');

    expect(sharedSource).toContain("from './changedOnly.js'");
    expect(sharedSource).not.toContain("from '../utils/changedFiles.js'");
    expect(sharedSource).not.toContain('function writeChangedOnlyNotice');
    expect(sharedSource).not.toContain('changedFilesAvailableMessage');
    expect(sharedSource).not.toContain('changedIssueFilterMessage');
  });

  it('filters issues to changed files and writes non-console status notices', async () => {
    const helper = await loadChangedOnlyHelper();
    const first = issue('first', ['src/a.ts']);
    const outside = issue('outside', ['src/b.ts']);
    const unlocated = issue('unlocated', []);
    const writes: string[] = [];

    const filtered = await helper.filterIssuesByChangedFilesForCli({
      issues: [first, outside, unlocated],
      rootPath: '/repo',
      baseRef: 'main',
      format: 'json',
      quiet: false,
      getChangedFiles: async (rootPath, explicitBaseRef) => {
        expect(rootPath).toBe('/repo');
        expect(explicitBaseRef).toBe('main');
        return { available: true, baseRef: 'main', files: ['src/a.ts'] };
      },
      write: (message) => writes.push(message),
    });

    expect(filtered).toEqual([first]);
    expect(writes).toEqual([
      '[--changed-only: base=main, 1 file(s)]',
      '[--changed-only: 2 issue(s) filtered out; 1 had no file location]',
    ]);
  });

  it('returns all issues when changed-file detection is unavailable', async () => {
    const helper = await loadChangedOnlyHelper();
    const first = issue('first', ['src/a.ts']);
    const writes: string[] = [];

    const filtered = await helper.filterIssuesByChangedFilesForCli({
      issues: [first],
      rootPath: '/repo',
      format: 'json',
      quiet: false,
      getChangedFiles: async () => ({
        available: false,
        reason: 'not a git repository',
        baseRef: null,
        files: [],
      }),
      write: (message) => writes.push(message),
    });

    expect(filtered).toEqual([first]);
    expect(writes).toEqual(['[--changed-only: not a git repository - reporting all issues]']);
  });

  it('suppresses changed-only notices in quiet mode', async () => {
    const helper = await loadChangedOnlyHelper();
    const first = issue('first', ['src/a.ts']);
    const writes: string[] = [];

    const filtered = await helper.filterIssuesByChangedFilesForCli({
      issues: [first],
      rootPath: '/repo',
      format: 'json',
      quiet: true,
      getChangedFiles: async () => ({ available: true, baseRef: 'main', files: ['src/a.ts'] }),
      write: (message) => writes.push(message),
    });

    expect(filtered).toEqual([first]);
    expect(writes).toEqual([]);
  });
});

async function loadChangedOnlyHelper(): Promise<ChangedOnlyHelper> {
  const helperPath = path.join(process.cwd(), 'src/cli/changedOnly.ts');
  if (!fs.existsSync(helperPath)) {
    expect(fs.existsSync(helperPath)).toBe(true);
    throw new Error('changedOnly helper is missing');
  }
  const modulePath = '../../src/cli/changedOnly.js';
  return (await import(modulePath)) as ChangedOnlyHelper;
}

function issue(id: string, files: string[]): Issue {
  return {
    id,
    title: id,
    description: id,
    severity: 'warning',
    category: 'test',
    fixAvailable: false,
    locations: files.map((file) => ({ file })),
  };
}
