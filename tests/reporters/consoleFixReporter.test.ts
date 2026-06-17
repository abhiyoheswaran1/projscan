import { describe, expect, it } from 'vitest';
import {
  reportDetectedIssues,
  reportFixResults,
} from '../../src/reporters/consoleFixReporter.js';
import {
  reportDetectedIssues as reportDetectedIssuesFromBarrel,
  reportFixResults as reportFixResultsFromBarrel,
} from '../../src/reporters/consoleReporter.js';
import type { Fix } from '../../src/types.js';
import { captureStdout, makeIssue, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

describe('consoleFixReporter', () => {
  it('lists detected issues and matching fixes', async () => {
    const fixes: Fix[] = [
      {
        id: 'add-readme',
        title: 'Create a README',
        description: 'Scaffold a README',
        issueId: 'missing-readme',
        apply: async () => {},
      },
    ];

    const out = await capturePlain(() =>
      reportDetectedIssues(
        [makeIssue({ fixAvailable: true, fixId: 'add-readme', title: 'Missing README' })],
        fixes,
      ),
    );

    expect(out).toContain('Detected Issues');
    expect(out).toContain('Missing README');
    expect(out).toContain('Proposed Fixes');
    expect(out).toContain('Create a README');
  });

  it('summarises fix success and failure outcomes', async () => {
    const fix: Fix = {
      id: 'add-readme',
      title: 'Create a README',
      description: 'Scaffold a README',
      issueId: 'missing-readme',
      apply: async () => {},
    };

    const out = await capturePlain(() =>
      reportFixResults([
        { fix, success: true },
        { fix, success: false, error: 'disk full' },
      ]),
    );

    expect(out).toContain('Create a README');
    expect(out.toLowerCase()).toContain('disk full');
  });

  it('keeps consoleReporter compatibility exports', () => {
    expect(reportDetectedIssuesFromBarrel).toBe(reportDetectedIssues);
    expect(reportFixResultsFromBarrel).toBe(reportFixResults);
  });
});
