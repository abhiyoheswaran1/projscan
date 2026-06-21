import { describe, expect, it } from 'vitest';

import { reportCi } from '../../src/reporters/consoleCiReporter.js';
import { reportCiJson } from '../../src/reporters/jsonReporter.js';
import { captureStdout, makeIssue, stripAnsi } from '../reporters/fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

describe('ci output', () => {
  it('emits annotation-ready issue fields in JSON output', async () => {
    const out = await captureStdout(() =>
      reportCiJson(
        [
          makeIssue({
            id: 'cycle-detected-1',
            title: 'Circular imports detected (2 files)',
            description:
              'Circular import among 2 files: src/a.ts, src/b.ts. Resolve by introducing an interface boundary.',
            severity: 'warning',
            category: 'architecture',
            fixAvailable: false,
            locations: [{ file: 'src/a.ts', line: 3 }, { file: 'src/b.ts' }],
            suggestedAction: { summary: 'Run projscan coupling --cycles-only for the full cycle.' },
          }),
        ],
        100,
      ),
    );

    const report = JSON.parse(out) as {
      ci: {
        issues: Array<{
          id: string;
          ruleId?: string;
          title: string;
          message?: string;
          severity: string;
          category: string;
          fixAvailable: boolean;
          location?: { file: string; line?: number };
          locations?: Array<{ file: string; line?: number }>;
          remediation?: string;
        }>;
      };
    };

    expect(report.ci.issues[0]).toMatchObject({
      id: 'cycle-detected-1',
      ruleId: 'cycle-detected-1',
      title: 'Circular imports detected (2 files)',
      message:
        'Circular import among 2 files: src/a.ts, src/b.ts. Resolve by introducing an interface boundary.',
      severity: 'warning',
      category: 'architecture',
      fixAvailable: false,
      location: { file: 'src/a.ts', line: 3 },
      locations: [{ file: 'src/a.ts', line: 3 }, { file: 'src/b.ts' }],
      remediation: 'Run projscan coupling --cycles-only for the full cycle.',
    });
  });

  it('prints rule, location, message, and remediation details for failing console output', async () => {
    const out = await capturePlain(() =>
      reportCi(
        [
          makeIssue({
            id: 'cycle-detected-1',
            title: 'Circular imports detected (2 files)',
            description:
              'Circular import among 2 files: src/a.ts, src/b.ts. Resolve by introducing an interface boundary.',
            severity: 'warning',
            category: 'architecture',
            fixAvailable: false,
            locations: [{ file: 'src/a.ts', line: 3 }, { file: 'src/b.ts' }],
            suggestedAction: { summary: 'Run projscan coupling --cycles-only for the full cycle.' },
          }),
        ],
        100,
      ),
    );

    expect(out).toContain('cycle-detected-1');
    expect(out).toContain('src/a.ts:3');
    expect(out).toContain('src/b.ts');
    expect(out).toContain(
      'Circular import among 2 files: src/a.ts, src/b.ts. Resolve by introducing an interface boundary.',
    );
    expect(out).toContain('Run projscan coupling --cycles-only for the full cycle.');
  });
});
