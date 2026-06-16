import { describe, expect, it } from 'vitest';
import { reportAudit } from '../../src/reporters/consoleAuditReporter.js';
import { reportAudit as reportAuditFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { AuditReport, AuditSeverity } from '../../src/types.js';
import { captureStdout, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

describe('consoleAuditReporter', () => {
  it('is re-exported from consoleReporter to preserve the public reporter API', () => {
    expect(reportAuditFromConsoleReporter).toBe(reportAudit);
  });

  it('prints unavailable audit reasons without a vulnerability heading', async () => {
    const out = await capturePlain(() =>
      reportAudit({
        available: false,
        reason: 'npm audit is unavailable',
        summary: emptySummary(),
        findings: [],
      }),
    );

    expect(out).toContain('npm audit is unavailable');
    expect(out).not.toContain('Vulnerability Audit');
  });

  it('renders a clean audit result', async () => {
    const out = await capturePlain(() =>
      reportAudit({
        available: true,
        summary: emptySummary(),
        findings: [],
      }),
    );

    expect(out).toContain('Vulnerability Audit');
    expect(out).toContain('No known vulnerabilities.');
  });

  it('renders severity summary, finding metadata, and fix markers', async () => {
    const out = await capturePlain(() => reportAudit(auditReport()));

    expect(out).toContain('1 critical');
    expect(out).toContain('2 high');
    expect(out).toContain('3 moderate');
    expect(out).toContain('4 low');
    expect(out).toContain('5 info');
    expect(out).toContain('[CRITICAL]');
    expect(out).toContain('critical-pkg');
    expect(out).toContain('(fix available)');
    expect(out).toContain('Critical issue');
    expect(out).toContain('range: <1.2.3');
    expect(out).toContain('https://example.com/advisories/critical-pkg');
    expect(out).toContain('Tip: run `npm audit fix`');
  });

  it('limits rendered findings to 30 and reports the hidden count', async () => {
    const findings = Array.from({ length: 32 }, (_, index) => ({
      name: `pkg-${index + 1}`,
      severity: 'low' as const,
      title: `Issue ${index + 1}`,
      via: [`pkg-${index + 1}`],
      fixAvailable: false,
    }));
    const out = await capturePlain(() =>
      reportAudit({
        available: true,
        summary: { critical: 0, high: 0, moderate: 0, low: findings.length, info: 0 },
        findings,
      }),
    );

    expect(out).toContain('pkg-30');
    expect(out).not.toContain('pkg-31');
    expect(out).toContain('… and 2 more. Use --format json for full list.');
  });
});

function emptySummary(): Record<AuditSeverity, number> {
  return { critical: 0, high: 0, moderate: 0, low: 0, info: 0 };
}

function auditReport(): AuditReport {
  return {
    available: true,
    summary: { critical: 1, high: 2, moderate: 3, low: 4, info: 5 },
    findings: [
      {
        name: 'critical-pkg',
        severity: 'critical',
        title: 'Critical issue',
        url: 'https://example.com/advisories/critical-pkg',
        via: ['critical-pkg'],
        range: '<1.2.3',
        fixAvailable: true,
      },
    ],
  };
}
