import { describe, expect, it } from 'vitest';
import { reportReview } from '../../src/reporters/consoleReviewReporter.js';
import { reportReview as reportReviewFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { ReviewReport } from '../../src/types.js';
import { captureStdout, stripAnsi } from './fixtures.js';

describe('consoleReviewReporter', () => {
  it('is re-exported from consoleReporter to preserve the public reporter API', () => {
    expect(reportReviewFromConsoleReporter).toBe(reportReview);
  });

  it('prints unavailable review output', async () => {
    const out = stripAnsi(
      await captureStdout(() =>
        reportReview(makeReview({ available: false, reason: 'git base unavailable' })),
      ),
    );

    expect(out).toContain('PR Review');
    expect(out).toContain('git base unavailable');
  });

  it('prints review verdict, summary, changed files, cycles, functions, and dependencies', async () => {
    const out = stripAnsi(await captureStdout(() => reportReview(makeReview())));

    expect(out).toContain('PR Review');
    expect(out).toContain('base main (abc1234) → head feature/review (def9876)');
    expect(out).toContain('Verdict: 🚫 BLOCK');
    expect(out).toContain('• Maximum changed-file risk score is 91.2.');
    expect(out).toContain('Changed files (top by risk):');
    expect(out).toContain('modified risk   91.2  CC  22 (Δ +5)  src/core/review.ts');
    expect(out).toContain('added    risk    -    CC   - (Δ   )  src/new.ts');
    expect(out).toContain('... and 1 more');
    expect(out).toContain('New / expanded cycles (6):');
    expect(out).toContain('NEW (2): src/a.ts → src/b.ts');
    expect(out).toContain('EXP (3): src/c.ts → src/d.ts → src/e.ts');
    expect(out).toContain('... and 1 more');
    expect(out).toContain('Risky functions (11):');
    expect(out).toContain('CC  16 parseReview  src/core/review.ts:42 [jumped] (9 → 16)');
    expect(out).toContain('CC  10 newRisk  src/new.ts:3 [added] (new)');
    expect(out).toContain('... and 1 more');
    expect(out).toContain('Dependency changes:');
    expect(out).toContain('package.json');
    expect(out).toContain('+ agentloopkit@^0.33.0 (dev)');
    expect(out).toContain('- old-tool@^1.0.0 (dep)');
    expect(out).toContain('~ projscan: ^4.2.0 → ^4.3.0 (dep)');
  });

  it('prints review and ok verdict labels', async () => {
    const reviewOut = stripAnsi(
      await captureStdout(() => reportReview(makeReview({ verdict: 'review' }))),
    );
    const okOut = stripAnsi(await captureStdout(() => reportReview(makeReview({ verdict: 'ok' }))));

    expect(reviewOut).toContain('Verdict: 👀 REVIEW');
    expect(okOut).toContain('Verdict: ✅ OK');
  });
});

function makeReview(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    available: true,
    base: { ref: 'main', resolvedSha: 'abc1234567890' },
    head: { ref: 'feature/review', resolvedSha: 'def9876543210' },
    prDiff: {} as ReviewReport['prDiff'],
    changedFiles: [
      {
        relativePath: 'src/core/review.ts',
        status: 'modified',
        riskScore: 91.2,
        cyclomaticComplexity: 22,
        cyclomaticDelta: 5,
        exportsAdded: 1,
        exportsRemoved: 0,
        importsAdded: 1,
        importsRemoved: 0,
      },
      {
        relativePath: 'src/new.ts',
        status: 'added',
        riskScore: null,
        cyclomaticComplexity: null,
        cyclomaticDelta: null,
        exportsAdded: 1,
        exportsRemoved: 0,
        importsAdded: 0,
        importsRemoved: 0,
      },
      ...Array.from({ length: 14 }, (_, index) => ({
        relativePath: `src/more-${index}.ts`,
        status: 'modified' as const,
        riskScore: 40 - index,
        cyclomaticComplexity: 3,
        cyclomaticDelta: -1,
        exportsAdded: 0,
        exportsRemoved: 0,
        importsAdded: 0,
        importsRemoved: 0,
      })),
    ],
    newCycles: [
      { classification: 'new', files: ['src/a.ts', 'src/b.ts'], size: 2 },
      { classification: 'expanded', files: ['src/c.ts', 'src/d.ts', 'src/e.ts'], size: 3 },
      ...Array.from({ length: 4 }, (_, index) => ({
        classification: 'new' as const,
        files: [`src/cycle-${index}.ts`, `src/cycle-${index + 1}.ts`],
        size: 2,
      })),
    ],
    riskyFunctions: [
      {
        file: 'src/core/review.ts',
        name: 'parseReview',
        line: 42,
        endLine: 58,
        cyclomaticComplexity: 16,
        baseCc: 9,
        reason: 'jumped',
      },
      {
        file: 'src/new.ts',
        name: 'newRisk',
        line: 3,
        endLine: 20,
        cyclomaticComplexity: 10,
        baseCc: null,
        reason: 'added',
      },
      ...Array.from({ length: 9 }, (_, index) => ({
        file: `src/risky-${index}.ts`,
        name: `risk${index}`,
        line: 10 + index,
        endLine: 15 + index,
        cyclomaticComplexity: 12,
        baseCc: 8,
        reason: 'crossed-threshold' as const,
      })),
    ],
    dependencyChanges: [
      {
        workspace: '',
        manifestFile: 'package.json',
        added: [{ name: 'agentloopkit', version: '^0.33.0', kind: 'dev' }],
        removed: [{ name: 'old-tool', version: '^1.0.0', kind: 'dep' }],
        bumped: [{ name: 'projscan', from: '^4.2.0', to: '^4.3.0', kind: 'dep' }],
      },
    ],
    contractChanges: [],
    newTaintFlows: [],
    newDataflowRisks: [],
    verdict: 'block',
    summary: ['Maximum changed-file risk score is 91.2.'],
    ...overrides,
  };
}
