import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Mission Control intent target architecture', () => {
  it('keeps report-scope parsing outside the large generic target module', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const reportScopeSource = readFileSync(
      path.join(process.cwd(), 'src/core/startReportScopeTargets.ts'),
      'utf8',
    );

    expect(targetSource).toContain(
      "export { extractReportScopeTarget } from './startReportScopeTargets.js';",
    );
    expect(targetSource).not.toContain('REPORT_SCOPE_DIRECTORY_TARGETS');
    expect(targetSource).not.toContain('function extractReportScopeTargets');
    expect(targetSource).not.toContain('function isReportScopePathTarget');

    expect(reportScopeSource).toContain('export function extractReportScopeTarget');
    expect(reportScopeSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps reliability search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const reliabilitySource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentReliabilityQueries.ts'),
      'utf8',
    );

    expect(targetSource).toContain(
      "import { extractReliabilityQuery } from './startIntentReliabilityQueries.js';",
    );
    expect(targetSource).not.toContain('function extractRateLimitQuery');
    expect(targetSource).not.toContain('function extractResiliencePatternQuery');

    expect(reliabilitySource).toContain('export function extractReliabilityQuery');
    expect(reliabilitySource).not.toContain("from './startIntentTargets.js'");
  });
});
