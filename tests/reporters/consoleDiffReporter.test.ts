import { describe, expect, it } from 'vitest';
import { reportDiff } from '../../src/reporters/consoleDiffReporter.js';
import { reportDiff as reportDiffFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { DiffResult, HotspotDelta } from '../../src/types.js';
import { captureStdout, makeDiff, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

function diff(overrides: Partial<DiffResult> = {}): DiffResult {
  return { ...makeDiff(), ...overrides };
}

function hotspotDelta(relativePath: string, overrides: Partial<HotspotDelta> = {}): HotspotDelta {
  return {
    relativePath,
    beforeScore: 50,
    afterScore: 60,
    scoreDelta: 10,
    ...overrides,
  };
}

describe('consoleDiffReporter', () => {
  it('renders score, grade, issue lists, and baseline timestamp', async () => {
    const out = await capturePlain(() => reportDiff(diff()));

    expect(out).toContain('Health Diff');
    expect(out).toContain('Score: 80');
    expect(out).toContain('75');
    expect(out).toContain('(-5)');
    expect(out).toContain('Grade: B');
    expect(out).toContain('C');
    expect(out).toContain('Resolved (1)');
    expect(out).toContain('old-issue');
    expect(out).toContain('New (1)');
    expect(out).toContain('new-issue');
    expect(out).toContain('Baseline: 2026-04-01T00:00:00.000Z');
  });

  it('renders no-change issue wording when no issues changed', async () => {
    const out = await capturePlain(() =>
      reportDiff(
        diff({
          before: { ...makeDiff().before, score: 80, grade: 'B' },
          after: { ...makeDiff().after, score: 80, grade: 'B' },
          scoreDelta: 0,
          newIssues: [],
          resolvedIssues: [],
        }),
      ),
    );

    expect(out).toContain('Score: 80');
    expect(out).toContain('(0)');
    expect(out).toContain('No change in issues.');
  });

  it('renders hotspot diff sections with existing truncation limits', async () => {
    const rose = Array.from({ length: 11 }, (_, index) =>
      hotspotDelta(`rose-${String(index + 1).padStart(2, '0')}.ts`, {
        beforeScore: 40 + index,
        afterScore: 50 + index,
        scoreDelta: 10,
      }),
    );
    const appeared = Array.from({ length: 11 }, (_, index) =>
      hotspotDelta(`appeared-${String(index + 1).padStart(2, '0')}.ts`, {
        beforeScore: null,
        afterScore: 70 + index,
        scoreDelta: 70 + index,
      }),
    );
    const fell = Array.from({ length: 11 }, (_, index) =>
      hotspotDelta(`fell-${String(index + 1).padStart(2, '0')}.ts`, {
        beforeScore: 90 - index,
        afterScore: 80 - index,
        scoreDelta: -10,
      }),
    );
    const resolved = Array.from({ length: 6 }, (_, index) =>
      hotspotDelta(`resolved-${String(index + 1).padStart(2, '0')}.ts`, {
        beforeScore: 80 - index,
        afterScore: null,
        scoreDelta: -80 + index,
      }),
    );

    const out = await capturePlain(() =>
      reportDiff(
        diff({
          hotspotDiff: { rose, appeared, fell, resolved },
        }),
      ),
    );

    expect(out).toContain('Hotspot Changes');
    expect(out).toContain('Worsening (11)');
    expect(out).toContain('rose-10.ts');
    expect(out).not.toContain('rose-11.ts');
    expect(out).toContain('Newly risky (11)');
    expect(out).toContain('appeared-10.ts');
    expect(out).not.toContain('appeared-11.ts');
    expect(out).toContain('Improving (11)');
    expect(out).toContain('fell-10.ts');
    expect(out).not.toContain('fell-11.ts');
    expect(out).toContain('No longer tracked (6)');
    expect(out).toContain('resolved-05.ts');
    expect(out).not.toContain('resolved-06.ts');
  });

  it('preserves the consoleReporter re-export', async () => {
    const out = await capturePlain(() => reportDiffFromConsoleReporter(diff()));

    expect(out).toContain('Health Diff');
    expect(out).toContain('old-issue');
  });
});
