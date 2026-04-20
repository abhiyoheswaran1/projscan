import { describe, it, expect } from 'vitest';
import { auditFindingsToIssues } from '../../src/core/auditRunner.js';
import type { AuditReport } from '../../src/types.js';

describe('auditFindingsToIssues', () => {
  it('returns empty when audit is unavailable', () => {
    const report: AuditReport = {
      available: false,
      reason: 'no lockfile',
      summary: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
      findings: [],
    };
    expect(auditFindingsToIssues(report)).toEqual([]);
  });

  it('maps severities to issue levels', () => {
    const report: AuditReport = {
      available: true,
      summary: { critical: 1, high: 0, moderate: 1, low: 1, info: 0 },
      findings: [
        { name: 'pkg-crit', severity: 'critical', title: 'Crit', via: [], fixAvailable: true },
        { name: 'pkg-mod', severity: 'moderate', title: 'Mod', via: [], fixAvailable: false },
        { name: 'pkg-low', severity: 'low', title: 'Low', via: [], fixAvailable: false },
      ],
    };
    const issues = auditFindingsToIssues(report);
    const byName = Object.fromEntries(issues.map((i) => [i.id, i.severity]));
    expect(byName['audit-pkg-crit']).toBe('error');
    expect(byName['audit-pkg-mod']).toBe('warning');
    expect(byName['audit-pkg-low']).toBe('info');
  });

  it('anchors issues to package.json', () => {
    const report: AuditReport = {
      available: true,
      summary: { critical: 0, high: 1, moderate: 0, low: 0, info: 0 },
      findings: [{ name: 'x', severity: 'high', title: 'T', via: [], fixAvailable: true }],
    };
    const [issue] = auditFindingsToIssues(report);
    expect(issue.locations?.[0].file).toBe('package.json');
  });
});
