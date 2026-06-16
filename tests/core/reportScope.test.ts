import { describe, expect, it } from 'vitest';
import {
  applyReportControlsToAnalysis,
  applyReportControlsToIssues,
  parseReportScopes,
  resolveReportControls,
} from '../../src/core/reportScope.js';
import type { AnalysisReport, Issue } from '../../src/types.js';

function issue(id: string, files: string[]): Issue {
  return {
    id,
    title: id,
    description: `issue ${id}`,
    severity: 'warning',
    category: 'test',
    fixAvailable: false,
    locations: files.map((file) => ({ file, line: 1 })),
  };
}

describe('reportScope', () => {
  it('parses comma-separated report scopes into normalized repo-relative paths', () => {
    expect(parseReportScopes(' ./src/private , packages/api/ ')).toEqual([
      'src/private',
      'packages/api',
    ]);
  });

  it('resolves a named report policy preset from config', () => {
    expect(
      resolveReportControls({
        reportPolicies: {
          apiEvidence: {
            reportScope: [' ./src/api/ ', 'packages/backend'],
            redactPaths: true,
          },
        },
        reportPolicy: 'apiEvidence',
      }),
    ).toEqual({
      scopes: ['src/api', 'packages/backend'],
      redactPaths: true,
    });
  });

  it('lets direct report flags override a selected report policy preset', () => {
    expect(
      resolveReportControls({
        reportPolicies: {
          apiEvidence: {
            reportScope: ['src/api'],
            redactPaths: false,
          },
        },
        reportPolicy: 'apiEvidence',
        reportScope: 'src/admin, ./packages/admin/',
        redactPaths: true,
      }),
    ).toEqual({
      scopes: ['src/admin', 'packages/admin'],
      redactPaths: true,
    });
  });

  it('fails clearly when a selected report policy preset is not configured', () => {
    expect(() =>
      resolveReportControls({
        reportPolicies: {
          publicEvidence: {
            reportScope: ['src/public'],
            redactPaths: false,
          },
        },
        reportPolicy: 'partnerEvidence',
      }),
    ).toThrow('Unknown report policy "partnerEvidence"');
  });

  it('fails clearly when a selected report policy name is blank', () => {
    expect(() =>
      resolveReportControls({
        reportPolicy: '   ',
      }),
    ).toThrow('Missing report policy name');
  });

  it('filters issues to scoped locations and removes out-of-scope evidence', () => {
    const issues = [
      issue('inside', ['src/private/secret.ts']),
      issue('mixed', ['src/private/secret.ts', 'src/public/index.ts']),
      issue('outside', ['src/public/index.ts']),
      { ...issue('unlocated', []), locations: undefined },
    ];

    const scoped = applyReportControlsToIssues(issues, { scopes: ['src/private'] });

    expect(scoped.map((item) => item.id)).toEqual(['inside', 'mixed']);
    expect(scoped[1].locations?.map((loc) => loc.file)).toEqual(['src/private/secret.ts']);
  });

  it('redacts scoped analysis paths without leaking root or out-of-scope file names', () => {
    const report: AnalysisReport = {
      projectName: 'fixture',
      rootPath: '/Users/alice/work/company/repo',
      scan: {
        rootPath: '/Users/alice/work/company/repo',
        totalFiles: 2,
        totalDirectories: 2,
        scanDurationMs: 10,
        scanBoundary: {
          source: 'glob',
          gitignoreRespected: true,
          includeIgnored: false,
          ignoredFileCount: 0,
        },
        files: [
          {
            relativePath: 'src/private/secret.ts',
            absolutePath: '/Users/alice/work/company/repo/src/private/secret.ts',
            extension: '.ts',
            sizeBytes: 42,
            directory: 'src/private',
          },
          {
            relativePath: 'src/public/index.ts',
            absolutePath: '/Users/alice/work/company/repo/src/public/index.ts',
            extension: '.ts',
            sizeBytes: 7,
            directory: 'src/public',
          },
        ],
        directoryTree: {
          name: 'repo',
          path: '/Users/alice/work/company/repo',
          fileCount: 0,
          totalFileCount: 2,
          children: [],
        },
      },
      languages: { primary: 'TypeScript', languages: {} },
      frameworks: { frameworks: [], buildTools: [], packageManager: 'unknown' },
      dependencies: null,
      issues: [issue('inside', ['src/private/secret.ts']), issue('outside', ['src/public/index.ts'])],
      timestamp: '2026-06-16T00:00:00.000Z',
    };

    const scoped = applyReportControlsToAnalysis(report, {
      scopes: ['src/private'],
      redactPaths: true,
    });
    const serialized = JSON.stringify(scoped);

    expect(scoped.rootPath).toBe('<redacted-root>');
    expect(scoped.scan.rootPath).toBe('<redacted-root>');
    expect(scoped.scan.files).toHaveLength(1);
    expect(scoped.scan.files[0].relativePath).toBe('redacted-path-1');
    expect(scoped.issues).toHaveLength(1);
    expect(scoped.issues[0].locations?.[0].file).toBe('redacted-path-1');
    expect(serialized).not.toContain('/Users/alice');
    expect(serialized).not.toContain('src/private/secret.ts');
    expect(serialized).not.toContain('src/public/index.ts');
  });

  it('redacts file paths embedded in issue text with the same stable labels', () => {
    const scoped = applyReportControlsToIssues(
      [
        {
          ...issue('cycle', ['src/private/a.ts', 'src/private/b.ts']),
          title: 'Cycle in src/private/a.ts',
          description: 'Circular import among src/private/a.ts and src/private/b.ts',
          suggestedAction: { summary: 'Break src/private/a.ts cycle' },
        },
      ],
      { scopes: ['src/private'], redactPaths: true },
    );
    const serialized = JSON.stringify(scoped);

    expect(scoped[0].title).toBe('Cycle in redacted-path-1');
    expect(scoped[0].description).toContain('redacted-path-1');
    expect(scoped[0].description).toContain('redacted-path-2');
    expect(scoped[0].suggestedAction?.summary).toBe('Break redacted-path-1 cycle');
    expect(scoped[0].locations?.map((location) => location.file)).toEqual([
      'redacted-path-1',
      'redacted-path-2',
    ]);
    expect(serialized).not.toContain('src/private');
  });

  it('redacts absolute path prefixes embedded in issue text', () => {
    const scoped = applyReportControlsToIssues(
      [
        {
          ...issue('absolute', ['src/private/a.ts']),
          title: 'Finding in /Users/alice/work/repo/src/private/a.ts',
          description:
            'See /tmp/review-copy/src/private/a.ts and C:\\Users\\Alice\\repo\\src\\private\\a.ts before sharing.',
        },
      ],
      { scopes: ['src/private'], redactPaths: true },
    );
    const serialized = JSON.stringify(scoped);

    expect(scoped[0].title).toBe('Finding in redacted-path-1');
    expect(scoped[0].description).toBe(
      'See redacted-path-1 and redacted-path-1 before sharing.',
    );
    expect(serialized).not.toContain('/Users/alice');
    expect(serialized).not.toContain('/tmp/review-copy');
    expect(serialized).not.toContain('C:\\Users\\Alice');
    expect(serialized).not.toContain('src/private');
  });

  it('redacts sibling path tokens without partially replacing shared prefixes', () => {
    const scoped = applyReportControlsToIssues(
      [
        {
          ...issue('siblings', ['src/private/a.ts', 'src/private/a.tsx']),
          title: 'Compare src/private/a.ts and src/private/a.tsx',
          description:
            'Both /tmp/review/src/private/a.ts and /tmp/review/src/private/a.tsx need review.',
        },
      ],
      { scopes: ['src/private'], redactPaths: true },
    );

    expect(scoped[0].title).toBe('Compare redacted-path-1 and redacted-path-2');
    expect(scoped[0].description).toBe(
      'Both redacted-path-1 and redacted-path-2 need review.',
    );
  });

  it('redacts path-like text in unlocated issues', () => {
    const scoped = applyReportControlsToIssues(
      [
        {
          ...issue('unlocated-path', []),
          locations: undefined,
          title: 'Review src/private/secret.ts before sharing',
          description: 'The partner note mentions src/private/secret.ts without a location.',
          suggestedAction: { summary: 'Remove src/private/secret.ts from exported evidence' },
        },
      ],
      { redactPaths: true },
    );
    const serialized = JSON.stringify(scoped);

    expect(scoped[0].title).toBe('Review redacted-path-1 before sharing');
    expect(scoped[0].description).toBe(
      'The partner note mentions redacted-path-1 without a location.',
    );
    expect(scoped[0].suggestedAction?.summary).toBe(
      'Remove redacted-path-1 from exported evidence',
    );
    expect(serialized).not.toContain('src/private/secret.ts');
  });

  it('preserves http urls while redacting standalone path tokens in issue text', () => {
    const scoped = applyReportControlsToIssues(
      [
        {
          ...issue('url-path', []),
          locations: undefined,
          title: 'See https://example.com/docs/src/private/secret.ts',
          description:
            'Internal file src/private/secret.ts differs from https://example.com/docs/src/private/secret.ts.',
        },
      ],
      { redactPaths: true },
    );

    expect(scoped[0].title).toBe('See https://example.com/docs/src/private/secret.ts');
    expect(scoped[0].description).toBe(
      'Internal file redacted-path-1 differs from https://example.com/docs/src/private/secret.ts.',
    );
  });
});
