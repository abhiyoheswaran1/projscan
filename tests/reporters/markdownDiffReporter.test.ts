import { describe, expect, it } from 'vitest';
import { reportDiffMarkdown } from '../../src/reporters/markdownDiffReporter.js';
import { reportDiffMarkdown as reportDiffMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import type { DiffResult, HotspotDelta } from '../../src/types.js';
import { captureStdout, makeDiff } from './fixtures.js';

function diff(overrides: Partial<DiffResult> = {}): DiffResult {
  return { ...makeDiff(), ...overrides };
}

function hotspotDelta(relativePath: string, overrides: Partial<HotspotDelta> = {}): HotspotDelta {
  return {
    relativePath,
    beforeScore: 40,
    afterScore: 60,
    scoreDelta: 20,
    ...overrides,
  };
}

describe('markdownDiffReporter', () => {
  it('renders the health diff metric table and issue sections', async () => {
    const out = await captureStdout(() => reportDiffMarkdown(diff()));

    expect(out).toContain('# Health Diff');
    expect(out).toContain('| Metric | Before | After | Delta |');
    expect(out).toContain('| Score | 80 | 75 | -5 ↓ |');
    expect(out).toContain('| Grade | B | C | |');
    expect(out).toContain('## Resolved');
    expect(out).toContain('- ✅ old-issue');
    expect(out).toContain('## New Issues');
    expect(out).toContain('- ❌ new-issue');
  });

  it('renders positive and zero score delta arrows', async () => {
    const positive = await captureStdout(() =>
      reportDiffMarkdown(
        diff({
          before: { ...makeDiff().before, score: 75, grade: 'C' },
          after: { ...makeDiff().after, score: 82, grade: 'B' },
          scoreDelta: 7,
          newIssues: [],
          resolvedIssues: [],
        }),
      ),
    );
    const zero = await captureStdout(() =>
      reportDiffMarkdown(
        diff({
          before: { ...makeDiff().before, score: 80, grade: 'B' },
          after: { ...makeDiff().after, score: 80, grade: 'B' },
          scoreDelta: 0,
          newIssues: [],
          resolvedIssues: [],
        }),
      ),
    );

    expect(positive).toContain('| Score | 75 | 82 | +7 ↑ |');
    expect(zero).toContain('| Score | 80 | 80 | 0 - |');
  });

  it('omits resolved and new issue sections when no issues changed', async () => {
    const out = await captureStdout(() =>
      reportDiffMarkdown(diff({ resolvedIssues: [], newIssues: [] })),
    );

    expect(out).not.toContain('## Resolved');
    expect(out).not.toContain('## New Issues');
  });

  it('renders hotspot rose, appeared, and fell sections', async () => {
    const out = await captureStdout(() =>
      reportDiffMarkdown(
        diff({
          hotspotDiff: {
            rose: [
              hotspotDelta('src/worse.ts', { beforeScore: 40, afterScore: 55, scoreDelta: 15 }),
            ],
            appeared: [
              hotspotDelta('src/new-risk.ts', {
                beforeScore: null,
                afterScore: 72,
                scoreDelta: 72,
              }),
            ],
            fell: [
              hotspotDelta('src/better.ts', { beforeScore: 80, afterScore: 60, scoreDelta: -20 }),
            ],
            resolved: [
              hotspotDelta('src/resolved.ts', {
                beforeScore: 70,
                afterScore: null,
                scoreDelta: -70,
              }),
            ],
          },
        }),
      ),
    );

    expect(out).toContain('## Hotspots Worsening');
    expect(out).toContain('| `src/worse.ts` | 40.0 | 55.0 | +15.0 |');
    expect(out).toContain('## Newly Risky Files');
    expect(out).toContain('| `src/new-risk.ts` | 72.0 |');
    expect(out).toContain('## Hotspots Improving');
    expect(out).toContain('| `src/better.ts` | 80.0 | 60.0 | -20.0 |');
    expect(out).not.toContain('src/resolved.ts');
  });

  it('preserves the markdownReporter re-export', async () => {
    const out = await captureStdout(() => reportDiffMarkdownFromMarkdownReporter(diff()));

    expect(out).toContain('# Health Diff');
    expect(out).toContain('| Score | 80 | 75 | -5 ↓ |');
  });
});
