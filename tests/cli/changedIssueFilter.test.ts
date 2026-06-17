import { describe, expect, it } from 'vitest';
import {
  changedFilesAvailableMessage,
  changedFilesUnavailableMessage,
  changedIssueFilterMessage,
  filterIssuesToChangedFiles,
} from '../../src/cli/changedIssueFilter.js';
import type { Issue } from '../../src/types.js';

describe('changed issue filtering', () => {
  it('keeps issues with at least one changed-file location', () => {
    const first = issue('first', ['src/a.ts']);
    const second = issue('second', ['src/b.ts', 'src/c.ts']);
    const outside = issue('outside', ['src/d.ts']);
    const unlocated = issue('unlocated', []);

    const result = filterIssuesToChangedFiles(
      [first, second, outside, unlocated],
      ['src/a.ts', 'src/c.ts'],
    );

    expect(result.issues).toEqual([first, second]);
    expect(result.dropped).toBe(2);
    expect(result.unlocated).toBe(1);
  });

  it('formats changed-only status messages', () => {
    expect(changedFilesUnavailableMessage('git unavailable')).toBe(
      '  [--changed-only: git unavailable - reporting all issues]',
    );
    expect(changedFilesUnavailableMessage()).toBe(
      '  [--changed-only: unavailable - reporting all issues]',
    );
    expect(changedFilesAvailableMessage('origin/main', 3)).toBe(
      '  [--changed-only: base=origin/main, 3 file(s)]',
    );
    expect(changedFilesAvailableMessage(null, 1)).toBe(
      '  [--changed-only: base=null, 1 file(s)]',
    );
    expect(changedIssueFilterMessage({ issues: [], dropped: 2, unlocated: 0 })).toBe(
      '  [--changed-only: 2 issue(s) outside the changed-file set]',
    );
    expect(changedIssueFilterMessage({ issues: [], dropped: 3, unlocated: 1 })).toBe(
      '  [--changed-only: 3 issue(s) filtered out; 1 had no file location]',
    );
    expect(changedIssueFilterMessage({ issues: [], dropped: 0, unlocated: 0 })).toBeNull();
  });
});

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
