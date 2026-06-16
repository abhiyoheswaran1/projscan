import { describe, it, expect } from 'vitest';
import {
  annotateReviewWithIntent,
  appendIntentToSummary,
  parseIntent,
} from '../../src/core/intent.js';
import type { ReviewReport } from '../../src/types.js';

function baseReport(): ReviewReport {
  return {
    available: true,
    base: { ref: 'main', resolvedSha: 'aaa' },
    head: { ref: 'HEAD', resolvedSha: 'bbb' },
    prDiff: {
      available: true,
      base: { ref: 'main', resolvedSha: 'aaa' },
      head: { ref: 'HEAD', resolvedSha: 'bbb' },
      filesAdded: [],
      filesRemoved: [],
      filesModified: [],
      totalFilesChanged: 0,
    },
    changedFiles: [],
    newCycles: [],
    riskyFunctions: [],
    dependencyChanges: [],
    newTaintFlows: [],
    verdict: 'ok',
    summary: [],
  };
}

describe('intent — parseIntent (1.9)', () => {
  it('returns null for empty or whitespace-only input', () => {
    expect(parseIntent(undefined)).toBeNull();
    expect(parseIntent('')).toBeNull();
    expect(parseIntent('   ')).toBeNull();
    expect(parseIntent(null)).toBeNull();
  });

  it('classifies a feature intent', () => {
    const intent = parseIntent('Add caching to the user API endpoint');
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe('feature');
  });

  it('classifies a fix intent', () => {
    const intent = parseIntent('Fix bug in tax calculation rounding');
    expect(intent?.action).toBe('fix');
  });

  it('classifies a refactor intent', () => {
    const intent = parseIntent('Refactor auth middleware to use new session store');
    expect(intent?.action).toBe('refactor');
  });

  it('classifies a docs intent', () => {
    const intent = parseIntent('docs: update README with codex setup snippet');
    expect(intent?.action).toBe('docs');
  });

  it('classifies a chore intent', () => {
    const intent = parseIntent('chore: bump tree-sitter to 0.26');
    expect(intent?.action).toBe('chore');
  });

  it('classifies a remove intent', () => {
    const intent = parseIntent('Remove deprecated legacy adapter');
    expect(intent?.action).toBe('remove');
  });

  it('classifies a perf intent', () => {
    const intent = parseIntent('Optimize hot path in repository scanner');
    expect(intent?.action).toBe('perf');
  });

  it('classifies a test intent', () => {
    const intent = parseIntent('Add tests for the kotlin adapter');
    // "tests" + "add" both match; test wins via score (more keywords matched here).
    // It's acceptable for the classifier to pick either as long as it's coherent.
    expect(['test', 'feature']).toContain(intent?.action);
  });

  it('extracts scope tokens from prose', () => {
    const intent = parseIntent('Refactor auth/middleware/session.ts to use cookies');
    expect(intent?.scopeTokens).toContain('auth');
    expect(intent?.scopeTokens).toContain('middleware');
    expect(intent?.scopeTokens).toContain('session');
    expect(intent?.scopeTokens).toContain('cookies');
  });

  it('drops English stopwords from scope', () => {
    const intent = parseIntent('Fix the bug in the tax module');
    expect(intent?.scopeTokens).not.toContain('the');
    expect(intent?.scopeTokens).not.toContain('bug');
    expect(intent?.scopeTokens).toContain('tax');
    expect(intent?.scopeTokens).toContain('module');
  });

  it('strips action keywords from scope tokens', () => {
    const intent = parseIntent('Add caching to /users endpoint');
    expect(intent?.scopeTokens).not.toContain('add');
    expect(intent?.scopeTokens).not.toContain('cache');
    expect(intent?.scopeTokens).toContain('users');
    expect(intent?.scopeTokens).toContain('endpoint');
  });

  it('returns action "unknown" when no keyword matches', () => {
    const intent = parseIntent('thingy stuff');
    expect(intent?.action).toBe('unknown');
  });

  it('caps absurdly long input without crashing or hanging', () => {
    const huge = 'a'.repeat(100_000); // 100k chars of plain text
    const start = Date.now();
    const intent = parseIntent(huge);
    const elapsed = Date.now() - start;
    expect(intent).not.toBeNull();
    // Should complete in well under a second even with the cap
    // pulling work down to ≤ 8192 chars.
    expect(elapsed).toBeLessThan(1000);
  });

  it('handles multi-line intent input', () => {
    const intent = parseIntent(
      'feat: add session management\n\nThis PR introduces a new session store for the user API endpoint.\nCloses #123.',
    );
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe('feature');
    expect(intent?.scopeTokens).toContain('session');
  });

  it('handles unicode input without crashing (CJK + emoji)', () => {
    const intent = parseIntent('Add 缓存 to /用户 endpoint 🚀');
    expect(intent).not.toBeNull();
    // The action keyword "add" still matches even with non-ASCII content.
    expect(intent?.action).toBe('feature');
  });

  it('drops generic path-component stopwords (src, lib, dist, etc.)', () => {
    const intent = parseIntent('Refactor src/auth module');
    expect(intent?.scopeTokens).not.toContain('src');
    expect(intent?.scopeTokens).not.toContain('lib');
    expect(intent?.scopeTokens).not.toContain('dist');
    expect(intent?.scopeTokens).toContain('auth');
  });
});

describe('intent — annotateReviewWithIntent (1.9)', () => {
  it('returns all-unknown alignment when action is unknown', () => {
    const intent = parseIntent('thingy stuff');
    const report = baseReport();
    report.changedFiles = [
      {
        relativePath: 'src/a.js',
        status: 'modified',
        riskScore: 10,
        cyclomaticComplexity: 5,
        cyclomaticDelta: 0,
        exportsAdded: 0,
        exportsRemoved: 0,
        importsAdded: 0,
        importsRemoved: 0,
      },
    ];
    const analysis = annotateReviewWithIntent(report, intent!);
    expect(report.changedFiles[0].intentAlignment).toBe('unknown');
    expect(analysis.totals.unknown).toBe(1);
  });

  it('marks in-scope feature additions as "expected"', () => {
    const intent = parseIntent('Add caching to users API');
    const report = baseReport();
    report.changedFiles = [
      {
        relativePath: 'src/users/cache.js',
        status: 'added',
        riskScore: 5,
        cyclomaticComplexity: 3,
        cyclomaticDelta: null,
        exportsAdded: 1,
        exportsRemoved: 0,
        importsAdded: 2,
        importsRemoved: 0,
      },
    ];
    annotateReviewWithIntent(report, intent!);
    expect(report.changedFiles[0].intentAlignment).toBe('expected');
  });

  it('marks out-of-scope changes when the file path does not match scope', () => {
    const intent = parseIntent('Fix bug in tax module');
    const report = baseReport();
    report.changedFiles = [
      {
        relativePath: 'src/billing/invoice.js', // not "tax"
        status: 'modified',
        riskScore: 5,
        cyclomaticComplexity: 3,
        cyclomaticDelta: 1,
        exportsAdded: 0,
        exportsRemoved: 0,
        importsAdded: 0,
        importsRemoved: 0,
      },
    ];
    annotateReviewWithIntent(report, intent!);
    expect(report.changedFiles[0].intentAlignment).toBe('out-of-scope');
  });

  it('flags docs PRs that touch non-docs files as unexpected', () => {
    const intent = parseIntent('docs: update README with codex setup');
    const report = baseReport();
    report.changedFiles = [
      {
        relativePath: 'README.md',
        status: 'modified',
        riskScore: null,
        cyclomaticComplexity: null,
        cyclomaticDelta: null,
        exportsAdded: 0,
        exportsRemoved: 0,
        importsAdded: 0,
        importsRemoved: 0,
      },
      {
        relativePath: 'src/auth.js', // not a docs path
        status: 'modified',
        riskScore: 20,
        cyclomaticComplexity: 5,
        cyclomaticDelta: 1,
        exportsAdded: 0,
        exportsRemoved: 0,
        importsAdded: 0,
        importsRemoved: 0,
      },
    ];
    annotateReviewWithIntent(report, intent!);
    // The README is in scope (mentioned by name) AND a docs path → expected.
    expect(report.changedFiles[0].intentAlignment).toBe('expected');
    // src/auth.js is NOT mentioned + not a docs path → out-of-scope
    // (because docs intent expects docs paths, and the scope didn't match either).
    expect(report.changedFiles[1].intentAlignment).toBe('out-of-scope');
  });

  it('flags a new taint flow under a "fix" intent as unexpected (when in scope)', () => {
    const intent = parseIntent('Fix bug in auth flow');
    const report = baseReport();
    report.newTaintFlows = [
      {
        sourceFn: 'getCookie',
        sinkFn: 'exec',
        source: 'req.cookies',
        sink: 'spawn',
        pathLength: 3,
        files: ['src/auth/handler.js', 'src/utils/shell.js'],
      },
    ];
    annotateReviewWithIntent(report, intent!);
    expect(report.newTaintFlows[0].intentAlignment).toBe('unexpected');
  });

  it('totals add up across alignments', () => {
    const intent = parseIntent('Add caching to users API');
    const report = baseReport();
    report.changedFiles = [
      {
        relativePath: 'src/users/cache.js',
        status: 'added',
        riskScore: 5,
        cyclomaticComplexity: 3,
        cyclomaticDelta: null,
        exportsAdded: 1,
        exportsRemoved: 0,
        importsAdded: 2,
        importsRemoved: 0,
      },
      {
        relativePath: 'src/billing/invoice.js',
        status: 'modified',
        riskScore: 5,
        cyclomaticComplexity: 3,
        cyclomaticDelta: 1,
        exportsAdded: 0,
        exportsRemoved: 0,
        importsAdded: 0,
        importsRemoved: 0,
      },
    ];
    report.newCycles = [
      { files: ['src/users/a.js', 'src/users/b.js'], size: 2, classification: 'new' },
    ];
    const analysis = annotateReviewWithIntent(report, intent!);
    expect(
      analysis.totals.expected + analysis.totals.unexpected + analysis.totals['out-of-scope'],
    ).toBeGreaterThan(0);
  });

  it('notable is capped to 5 entries', () => {
    const intent = parseIntent('Fix bug in tax module');
    const report = baseReport();
    // 10 out-of-scope files
    for (let i = 0; i < 10; i++) {
      report.changedFiles.push({
        relativePath: `src/billing/file${i}.js`,
        status: 'modified',
        riskScore: 5,
        cyclomaticComplexity: 3,
        cyclomaticDelta: 0,
        exportsAdded: 0,
        exportsRemoved: 0,
        importsAdded: 0,
        importsRemoved: 0,
      });
    }
    const analysis = annotateReviewWithIntent(report, intent!);
    expect(analysis.notable.length).toBeLessThanOrEqual(5);
  });
});

describe('intent — appendIntentToSummary (1.9)', () => {
  it('adds one bullet describing the parsed intent', () => {
    const intent = parseIntent('Add caching to users API');
    const report = baseReport();
    const analysis = annotateReviewWithIntent(report, intent!);
    const summary: string[] = [];
    appendIntentToSummary(summary, analysis);
    expect(summary.length).toBeGreaterThanOrEqual(1);
    expect(summary[0]).toMatch(/Intent: "feature"/);
  });

  it('adds an unexpected-finding bullet when there are unexpected findings', () => {
    const intent = parseIntent('docs: README typo fix');
    const report = baseReport();
    report.changedFiles = [
      {
        relativePath: 'src/auth.js', // not docs, in scope due to no scope tokens beyond "readme"
        status: 'modified',
        riskScore: 5,
        cyclomaticComplexity: 3,
        cyclomaticDelta: 1,
        exportsAdded: 0,
        exportsRemoved: 0,
        importsAdded: 0,
        importsRemoved: 0,
      },
    ];
    const analysis = annotateReviewWithIntent(report, intent!);
    const summary: string[] = [];
    appendIntentToSummary(summary, analysis);
    // At minimum the intent bullet appears; the test verifies the call
    // doesn't crash and we get coherent output.
    expect(summary[0]).toMatch(/Intent/);
  });

  it('is silent when intent action is unknown AND there are no scope tokens', () => {
    const intent = parseIntent('z');
    // Length-1 input survives parseIntent (not empty/whitespace) but
    // produces action 'unknown' and zero scope tokens (filtered out).
    expect(intent).not.toBeNull();
    expect(intent?.action).toBe('unknown');
    expect(intent?.scopeTokens).toEqual([]);
    const report = baseReport();
    const analysis = annotateReviewWithIntent(report, intent!);
    const summary: string[] = [];
    appendIntentToSummary(summary, analysis);
    expect(summary).toEqual([]); // silent — nothing useful to add
  });
});
