import { describe, expect, it } from 'vitest';
import { reportReviewMarkdown } from '../../src/reporters/markdownReviewReporter.js';
import { reportReviewMarkdown as reportReviewMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import { captureStdout, makeReviewReport } from './fixtures.js';

describe('markdownReviewReporter', () => {
  it('prints unavailable review reasons', async () => {
    const out = await captureStdout(() =>
      reportReviewMarkdown(makeReviewReport({ available: false, reason: 'git base unavailable' })),
    );

    expect(out).toContain('# PR Review');
    expect(out).toContain('> git base unavailable');
    expect(out).not.toContain('**Verdict:**');
  });

  it('prints review verdict, summary, changed files, cycles, functions, and dependencies', async () => {
    const out = await captureStdout(() => reportReviewMarkdown(makeReviewReport()));

    expect(out).toContain('# PR Review');
    expect(out).toContain('_base **main** (abc1234) → head **feature/review** (def9876)_');
    expect(out).toContain('**Verdict:** 🚫 BLOCK');
    expect(out).toContain('- Maximum changed-file risk score is 91.2.');
    expect(out).toContain('## Changed files');
    expect(out).toContain('| `src/core/review.ts` | modified | 91.2 | 22 | +5 |');
    expect(out).toContain('| `src/new.ts` | added | - | - | - |');
    expect(out).toContain('## New / expanded import cycles');
    expect(out).toContain('- **new** (2 files): `src/a.ts` → `src/b.ts`');
    expect(out).toContain('## Risky functions');
    expect(out).toContain('| `parseReview` | `src/core/review.ts`:L42 | 16 | jumped | 9 → 16 |');
    expect(out).toContain('| `newRisk` | `src/new.ts`:L3 | 10 | added | new |');
    expect(out).toContain('## Dependency changes');
    expect(out).toContain('### `package.json`');
    expect(out).toContain('- ➕ `agentloopkit@^0.33.0` (dev)');
    expect(out).toContain('- ➖ `old-tool@^1.0.0` (dep)');
    expect(out).toContain('- 🔄 `projscan`: `^4.2.0` → `^4.3.0` (dep)');
  });

  it('prints review and ok verdict labels', async () => {
    const reviewOut = await captureStdout(() =>
      reportReviewMarkdown(makeReviewReport({ verdict: 'review' })),
    );
    const okOut = await captureStdout(() =>
      reportReviewMarkdown(makeReviewReport({ verdict: 'ok' })),
    );

    expect(reviewOut).toContain('**Verdict:** 👀 REVIEW');
    expect(okOut).toContain('**Verdict:** ✅ OK');
  });

  it('keeps changed-file and risky-function output bounded', async () => {
    const changedFiles = Array.from({ length: 52 }, (_, index) => ({
      relativePath: `src/file-${index + 1}.ts`,
      status: 'modified' as const,
      riskScore: 100 - index,
      cyclomaticComplexity: index,
      cyclomaticDelta: index - 1,
      exportsAdded: 0,
      exportsRemoved: 0,
      importsAdded: 0,
      importsRemoved: 0,
    }));
    const riskyFunctions = Array.from({ length: 31 }, (_, index) => ({
      file: `src/risky-${index + 1}.ts`,
      name: `risk${index + 1}`,
      line: index + 1,
      endLine: index + 2,
      cyclomaticComplexity: 40 - index,
      baseCc: index,
      reason: 'crossed-threshold' as const,
    }));

    const out = await captureStdout(() =>
      reportReviewMarkdown(makeReviewReport({ changedFiles, riskyFunctions })),
    );

    expect(out).toContain('| `src/file-1.ts` | modified | 100.0 | 0 | -1 |');
    expect(out).toContain('| `src/file-50.ts` | modified | 51.0 | 49 | +48 |');
    expect(out).not.toContain('`src/file-51.ts`');
    expect(out).toContain('_... and 2 more files_');
    expect(out).toContain('| `risk1` | `src/risky-1.ts`:L1 | 40 | crossed-threshold | 0 → 40 |');
    expect(out).toContain(
      '| `risk30` | `src/risky-30.ts`:L30 | 11 | crossed-threshold | 29 → 11 |',
    );
    expect(out).not.toContain('`risk31`');
  });

  it('preserves the markdownReporter re-export', () => {
    expect(reportReviewMarkdownFromMarkdownReporter).toBe(reportReviewMarkdown);
  });
});
