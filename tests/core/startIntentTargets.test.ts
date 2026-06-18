import { describe, expect, it } from 'vitest';
import {
  escapeDoubleQuoted,
  extractAuditPackageTarget,
  extractFileTarget,
  extractImpactTarget,
  extractIssueIdTarget,
  extractPackageTarget,
  extractReportScopeTarget,
  extractSearchQuery,
  graphQueryFromIntent,
  graphQueryIsReady,
  quoteShellArg,
  semanticGraphCommand,
} from '../../src/core/startIntentTargets.js';

describe('Mission Control intent target parsing', () => {
  it('extracts search queries used by Mission Control search actions', () => {
    expect(extractSearchQuery('where are the tests for src/core/start.ts?')).toBe(
      'tests for src/core/start.ts',
    );
    expect(extractSearchQuery('which env var controls auth?')).toBe('auth env var');
    expect(extractSearchQuery('what rate limits protect checkout?')).toBe('checkout rate limits');
    expect(extractSearchQuery('where is the React Query mutation for checkout?')).toBe(
      'checkout React Query mutation',
    );
    expect(extractSearchQuery('where are the migrations?')).toBe('migrations');
  });

  it('extracts route targets for impact, files, issues, and packages', () => {
    expect(extractImpactTarget('what breaks if I rename the auth token loader')).toBe(
      'auth token loader',
    );
    expect(extractFileTarget('show me src/core/start.ts')).toBe('src/core/start.ts');
    expect(extractIssueIdTarget('explain issue no-console-log')).toBe('no-console-log');
    expect(extractPackageTarget('upgrade @babel/parser')).toBe('@babel/parser');
    expect(extractAuditPackageTarget('does chalk have vulnerabilities?')).toBe('chalk');
    expect(
      extractReportScopeTarget('share redacted evidence for src/api and packages/backend'),
    ).toBe('src/api,packages/backend');
  });

  it('builds graph queries and shell-safe command arguments', () => {
    const query = graphQueryFromIntent('who imports src/core/start.ts');

    expect(query).toEqual({ direction: 'importers', file: 'src/core/start.ts' });
    expect(query && graphQueryIsReady(query)).toBe(true);
    expect(query && semanticGraphCommand(query)).toBe(
      'projscan semantic-graph --query importers --file src/core/start.ts --format json',
    );
    expect(escapeDoubleQuoted('auth $(echo boom) `token`')).toBe('auth \\$(echo boom) \\`token\\`');
    expect(quoteShellArg('auth token loader')).toBe('"auth token loader"');
  });
});
