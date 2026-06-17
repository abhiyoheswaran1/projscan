import { expect, test } from 'vitest';
import type { PreflightChangedFiles } from '../../src/core/preflightChangedFiles.js';
import { MAX_PREFLIGHT_EVIDENCE_FILES } from '../../src/core/preflightEvidence.js';
import { isPreflightReportTruncated } from '../../src/core/preflightTruncation.js';
import type { PreflightEvidence } from '../../src/types.js';

test('preflight truncation is true when session evidence was already truncated', () => {
  expect(
    isPreflightReportTruncated({
      evidence: { session: sessionEvidence({ truncated: true }) },
      changedFiles: changedFileEvidence(0),
    }),
  ).toBe(true);
});

test('preflight truncation is true when changed files exceed evidence capacity', () => {
  expect(
    isPreflightReportTruncated({
      evidence: {},
      changedFiles: changedFileEvidence(MAX_PREFLIGHT_EVIDENCE_FILES + 1),
    }),
  ).toBe(true);
});

test('preflight truncation is true when touched hotspots exceed evidence capacity', () => {
  expect(
    isPreflightReportTruncated({
      evidence: {
        hotspots: {
          touched: Array.from({ length: MAX_PREFLIGHT_EVIDENCE_FILES + 1 }, (_, index) => ({
            file: `src/hotspot-${index}.ts`,
            riskScore: 100 - index,
          })),
        },
      },
      changedFiles: changedFileEvidence(0),
    }),
  ).toBe(true);
});

test('preflight truncation is false at the evidence capacity boundary', () => {
  expect(
    isPreflightReportTruncated({
      evidence: {
        session: sessionEvidence(),
        hotspots: {
          touched: Array.from({ length: MAX_PREFLIGHT_EVIDENCE_FILES }, (_, index) => ({
            file: `src/hotspot-${index}.ts`,
            riskScore: 100 - index,
          })),
        },
      },
      changedFiles: changedFileEvidence(MAX_PREFLIGHT_EVIDENCE_FILES),
    }),
  ).toBe(false);
});

function changedFileEvidence(count: number): PreflightChangedFiles {
  return {
    available: true,
    count,
    files: Array.from({ length: count }, (_, index) => `src/file-${index}.ts`),
    baseRef: 'HEAD',
  };
}

function sessionEvidence(
  overrides: Partial<NonNullable<PreflightEvidence['session']>> = {},
): NonNullable<PreflightEvidence['session']> {
  return {
    kind: 'remembered-session',
    id: 'session-1',
    touchedFiles: [],
    totalTouchedFiles: 0,
    eventCount: 0,
    ...overrides,
  };
}
