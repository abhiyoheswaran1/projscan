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
  isPlaceholder,
  quoteShellArg,
  quoteShellArgOrPlaceholder,
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
    expect(extractSearchQuery('where is input validation for checkout?')).toBe(
      'checkout input validation',
    );
    expect(extractSearchQuery('which component renders the checkout page?')).toBe(
      'checkout page component',
    );
    expect(extractSearchQuery('where is the Zustand store for checkout?')).toBe(
      'checkout Zustand store',
    );
    expect(extractSearchQuery('where are the Prisma models for checkout?')).toBe(
      'checkout Prisma model',
    );
    expect(extractSearchQuery('where do we call Stripe?')).toBe('Stripe API');
    expect(extractSearchQuery('where is tRPC router for billing?')).toBe(
      'billing tRPC router',
    );
    expect(extractSearchQuery('where is Terraform module for S3?')).toBe(
      'S3 Terraform module',
    );
    expect(extractSearchQuery('where is pnpm lockfile?')).toBe('pnpm lockfile');
    expect(extractSearchQuery('where is refund handling for payments?')).toBe(
      'payments refund handling',
    );
    expect(extractSearchQuery('where is push notification copy for invites?')).toBe(
      'invites push notification copy',
    );
    expect(extractSearchQuery('which role can access admin?')).toBe('admin role access');
    expect(extractSearchQuery('which CSS module styles Button?')).toBe('Button CSS module');
    expect(extractSearchQuery('where is sidebar nav item for billing?')).toBe(
      'billing sidebar nav item',
    );
    expect(extractSearchQuery('which page renders /account/settings?')).toBe(
      '/account/settings page',
    );
    expect(extractSearchQuery('where are fixtures for checkout?')).toBe('checkout fixtures');
    expect(extractSearchQuery('which queue processes invoices?')).toBe('invoices queue');
    expect(extractSearchQuery('what logs should I check for checkout?')).toBe('checkout logs');
    expect(extractSearchQuery('where is error "checkout failed" logged?')).toBe(
      'checkout failed',
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
    expect(isPlaceholder('<file>')).toBe(true);
    expect(quoteShellArgOrPlaceholder('<file>')).toBe('<file>');
    expect(quoteShellArg('auth token loader')).toBe('"auth token loader"');
  });
});
