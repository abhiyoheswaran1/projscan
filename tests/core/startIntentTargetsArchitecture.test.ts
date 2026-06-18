import { existsSync, readFileSync } from 'node:fs';
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

  it('keeps data-contract search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const dataContractSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentDataContractQueries.ts'),
      'utf8',
    );

    expect(targetSource).toContain(
      "import { extractDataContractQuery } from './startIntentDataContractQueries.js';",
    );
    expect(targetSource).not.toContain('function extractValidationQuery');
    expect(targetSource).not.toContain('function extractDatabaseConsistencyQuery');

    expect(dataContractSource).toContain('export function extractDataContractQuery');
    expect(dataContractSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps UI interaction search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const uiInteractionSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentUiInteractionQueries.ts'),
      'utf8',
    );

    expect(targetSource).toContain(
      "import { extractUiInteractionQuery } from './startIntentUiInteractionQueries.js';",
    );
    expect(targetSource).not.toContain('UI_INTERACTION_RULES');
    expect(targetSource).not.toContain('function fixedUiInteractionQuery');

    expect(uiInteractionSource).toContain('export function extractUiInteractionQuery');
    expect(uiInteractionSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps state-management search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const stateSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentStateManagementQueries.ts'),
      'utf8',
    );

    expect(targetSource).toContain(
      "import { extractStateManagementQuery } from './startIntentStateManagementQueries.js';",
    );
    expect(targetSource).not.toContain('STATE_MANAGEMENT_RULES');
    expect(targetSource).not.toContain('function normalizeStateFramework');

    expect(stateSource).toContain('export function extractStateManagementQuery');
    expect(stateSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps data-access search query parsing in a focused helper', () => {
    const targetSource = readFileSync(
      path.join(process.cwd(), 'src/core/startIntentTargets.ts'),
      'utf8',
    );
    const dataAccessPath = path.join(
      process.cwd(),
      'src/core/startIntentDataAccessQueries.ts',
    );

    expect(targetSource).toContain(
      "import { extractDataAccessQuery } from './startIntentDataAccessQueries.js';",
    );
    expect(targetSource).not.toContain('DATA_ACCESS_RULES');
    expect(targetSource).not.toContain('function normalizeDataAccessFramework');

    expect(existsSync(dataAccessPath)).toBe(true);
    const dataAccessSource = readFileSync(dataAccessPath, 'utf8');
    expect(dataAccessSource).toContain('export function extractDataAccessQuery');
    expect(dataAccessSource).not.toContain("from './startIntentTargets.js'");
  });
});
