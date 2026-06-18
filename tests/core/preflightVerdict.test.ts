import { expect, test } from 'vitest';
import type { PreflightMode, PreflightReason, PreflightReport } from '../../src/types.js';
import { decidePreflightVerdict, summarizePreflight } from '../../src/core/preflight.js';

test('preflight contract supports the three agent modes', () => {
  const modes: PreflightMode[] = ['before_edit', 'before_commit', 'before_merge'];

  expect(modes).toEqual(['before_edit', 'before_commit', 'before_merge']);
});

test('preflight verdict escalates from reasons', () => {
  const warning: PreflightReason = {
    severity: 'warning',
    source: 'doctor',
    message: 'warning',
  };
  const error: PreflightReason = {
    severity: 'error',
    source: 'review',
    message: 'error',
  };

  expect(decidePreflightVerdict([])).toBe('proceed');
  expect(decidePreflightVerdict([warning])).toBe('caution');
  expect(decidePreflightVerdict([warning, error])).toBe('block');
});

test('preflight summary is compact and agent-ready', () => {
  const report: PreflightReport = {
    schemaVersion: 1,
    mode: 'before_edit',
    verdict: 'proceed',
    summary: '',
    reasons: [],
    evidence: {},
    requiredChecks: [],
    suggestedNextActions: [],
    toolCalls: [],
  };

  expect(summarizePreflight(report)).toBe('proceed: no blocking or cautionary signals found');
});
