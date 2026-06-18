import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Mission Control intent target architecture', () => {
  it('keeps report-scope parsing outside the large generic target module', () => {
    const targetSource = readSource('src/core/startIntentTargets.ts');
    const reportScopeSource = readSource('src/core/startReportScopeTargets.ts');

    expect(targetSource).toContain(
      "export { extractReportScopeTarget } from './startReportScopeTargets.js';",
    );
    expect(targetSource).not.toContain('REPORT_SCOPE_DIRECTORY_TARGETS');
    expect(targetSource).not.toContain('function extractReportScopeTargets');
    expect(targetSource).not.toContain('function isReportScopePathTarget');

    expect(reportScopeSource).toContain('export function extractReportScopeTarget');
    expect(reportScopeSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps tooling config search query parsing in a focused helper', () => {
    const targetSource = readSource('src/core/startIntentTargets.ts');
    const toolingPath = path.join(
      process.cwd(),
      'src/core/startIntentToolingConfigQueries.ts',
    );
    const generatedConfigPath = path.join(
      process.cwd(),
      'src/core/startGeneratedConfigSearchTargets.ts',
    );

    expect(targetSource).toContain(
      "import { searchQueryFromGeneratedAndConfig } from './startGeneratedConfigSearchTargets.js';",
    );
    expect(targetSource).not.toContain('extractToolingConfigQuery');
    expect(targetSource).not.toContain('TOOLING_CONFIG_RULES');
    expect(targetSource).not.toContain('function lockfileQuery');

    expect(existsSync(generatedConfigPath)).toBe(true);
    const generatedConfigSource = readFileSync(generatedConfigPath, 'utf8');
    expect(generatedConfigSource).toContain(
      "import { extractToolingConfigQuery } from './startIntentToolingConfigQueries.js';",
    );
    expect(existsSync(toolingPath)).toBe(true);
    const toolingSource = readFileSync(toolingPath, 'utf8');
    expect(toolingSource).toContain('export function extractToolingConfigQuery');
    expect(toolingSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps domain search-query architecture in a focused test file', () => {
    const domainSearchTestPath = path.join(
      process.cwd(),
      'tests/core/startIntentDomainSearchArchitecture.test.ts',
    );

    expect(existsSync(domainSearchTestPath)).toBe(true);
    const domainSearchTestSource = readFileSync(domainSearchTestPath, 'utf8');
    expect(domainSearchTestSource).toContain(
      "describe('Mission Control intent domain search architecture'",
    );
    expect(domainSearchTestSource).toContain(
      "import { extractReliabilityQuery } from './startIntentReliabilityQueries.js';",
    );
    expect(domainSearchTestSource).toContain('export function searchQueryFromDomainSignals');
  });

  it('delegates the ordered domain search query chain to a focused helper', () => {
    const targetSource = readSource('src/core/startIntentTargets.ts');

    expect(targetSource).toContain(
      "import { searchQueryFromDomainSignals } from './startIntentDomainSearchQueries.js';",
    );
    expect(targetSource).not.toContain('type QueryExtractor');
    expect(targetSource).not.toContain('function firstQuery');
    expect(targetSource).not.toContain('function searchQueryFromDomainSignals');
    expect(targetSource).not.toContain("from './startIntentReliabilityQueries.js'");
    expect(targetSource).not.toContain("from './startIntentDomainWorkflowQueries.js'");
  });
});

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}
