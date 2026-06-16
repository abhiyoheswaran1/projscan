import { describe, expect, it } from 'vitest';
import { reportExplanation } from '../../src/reporters/consoleExplanationReporter.js';
import { reportExplanation as reportExplanationFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { FileExplanation } from '../../src/types.js';
import { captureStdout, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

describe('consoleExplanationReporter', () => {
  it('is re-exported from consoleReporter to preserve the public reporter API', () => {
    expect(reportExplanationFromConsoleReporter).toBe(reportExplanation);
  });

  it('renders file metadata', async () => {
    const out = await capturePlain(() => reportExplanation(explanation()));

    expect(out).toContain('File Explanation');
    expect(out).toContain('File:');
    expect(out).toContain('src/index.ts');
    expect(out).toContain('Lines:');
    expect(out).toContain('42');
    expect(out).toContain('Purpose:');
    expect(out).toContain('Entry point');
  });

  it('renders package and local dependency labels', async () => {
    const out = await capturePlain(() => reportExplanation(explanation()));

    expect(out).toContain('Dependencies');
    expect(out).toContain('(package) react');
    expect(out).toContain('(local) ./local.js');
  });

  it('renders key exports and potential issues when present', async () => {
    const out = await capturePlain(() => reportExplanation(explanation()));

    expect(out).toContain('Key Exports');
    expect(out).toContain('App');
    expect(out).toContain('[function]');
    expect(out).toContain('Potential Issues');
    expect(out).toContain('Large file');
  });
});

function explanation(): FileExplanation {
  return {
    filePath: 'src/index.ts',
    purpose: 'Entry point',
    imports: [
      { source: 'react', specifiers: ['default'], isRelative: false },
      { source: './local.js', specifiers: ['local'], isRelative: true },
    ],
    exports: [{ name: 'App', type: 'function' }],
    potentialIssues: ['Large file'],
    lineCount: 42,
  };
}
