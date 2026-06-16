import { describe, expect, it } from 'vitest';
import { reportPrDiff } from '../../src/reporters/consolePrDiffReporter.js';
import { reportPrDiff as reportPrDiffFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { PrDiffReport } from '../../src/types.js';
import { captureStdout, stripAnsi } from './fixtures.js';

describe('consolePrDiffReporter', () => {
  it('is re-exported from consoleReporter to preserve the public reporter API', () => {
    expect(reportPrDiffFromConsoleReporter).toBe(reportPrDiff);
  });

  it('prints unavailable PR diff output', async () => {
    const out = stripAnsi(
      await captureStdout(() =>
        reportPrDiff(makePrDiff({ available: false, reason: 'base ref missing' })),
      ),
    );

    expect(out).toContain('PR Structural Diff');
    expect(out).toContain('base ref missing');
  });

  it('prints PR diff totals and added, removed, and modified sections', async () => {
    const out = stripAnsi(await captureStdout(() => reportPrDiff(makePrDiff())));

    expect(out).toContain('PR Structural Diff');
    expect(out).toContain('base main (abc1234) → head feature/diff (def9876)');
    expect(out).toContain('6 files changed: +1 -1 ~4');
    expect(out).toContain('Added:');
    expect(out).toContain('+ src/new.ts');
    expect(out).toContain('Removed:');
    expect(out).toContain('- src/old.ts');
    expect(out).toContain('Modified:');
    expect(out).toContain('~ src/app.ts, ΔCC +3, Δfan-in +2');
    expect(out).toContain('+exports: newApi');
    expect(out).toContain('-exports: oldApi');
    expect(out).toContain('~exports: oldName → newName');
    expect(out).toContain('+imports: ./new.js');
    expect(out).toContain('-imports: ./old.js');
    expect(out).toContain('~ src/risk.ts, ΔCC -2, Δfan-in -1');
    expect(out).toContain('~ src/neutral.ts, ΔCC +0');
    expect(out).not.toContain('src/neutral.ts, ΔCC +0, Δfan-in +0');
    expect(out).toContain('~ src/unknown.ts');
    expect(out).not.toContain('src/unknown.ts, ΔCC');
  });

  it('prints singular file total text', async () => {
    const out = stripAnsi(
      await captureStdout(() =>
        reportPrDiff(
          makePrDiff({
            filesAdded: [],
            filesRemoved: [],
            filesModified: [modifiedFile({ relativePath: 'src/one.ts' })],
            totalFilesChanged: 1,
          }),
        ),
      ),
    );

    expect(out).toContain('1 file changed: +0 -0 ~1');
  });
});

function makePrDiff(overrides: Partial<PrDiffReport> = {}): PrDiffReport {
  return {
    available: true,
    base: { ref: 'main', resolvedSha: 'abc1234567890' },
    head: { ref: 'feature/diff', resolvedSha: 'def9876543210' },
    filesAdded: ['src/new.ts'],
    filesRemoved: ['src/old.ts'],
    filesModified: [
      modifiedFile({
        relativePath: 'src/app.ts',
        exportsAdded: ['newApi'],
        exportsRemoved: ['oldApi'],
        exportsRenamed: [{ from: 'oldName', to: 'newName' }],
        importsAdded: ['./new.js'],
        importsRemoved: ['./old.js'],
        cyclomaticDelta: 3,
        fanInDelta: 2,
      }),
      modifiedFile({
        relativePath: 'src/risk.ts',
        cyclomaticDelta: -2,
        fanInDelta: -1,
      }),
      modifiedFile({
        relativePath: 'src/neutral.ts',
        cyclomaticDelta: 0,
        fanInDelta: 0,
      }),
      modifiedFile({
        relativePath: 'src/unknown.ts',
        cyclomaticDelta: null,
        fanInDelta: null,
      }),
    ],
    totalFilesChanged: 6,
    ...overrides,
  };
}

function modifiedFile(
  overrides: Partial<PrDiffReport['filesModified'][number]> = {},
): PrDiffReport['filesModified'][number] {
  return {
    relativePath: 'src/file.ts',
    status: 'modified',
    exportsAdded: [],
    exportsRemoved: [],
    exportsRenamed: [],
    importsAdded: [],
    importsRemoved: [],
    callsAdded: [],
    callsRemoved: [],
    cyclomaticDelta: 1,
    fanInDelta: 1,
    ...overrides,
  };
}
