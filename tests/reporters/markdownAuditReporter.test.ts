import { describe, expect, it } from 'vitest';
import { reportAuditMarkdown } from '../../src/reporters/markdownAuditReporter.js';
import { reportAuditMarkdown as reportAuditMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import type { AuditReport, AuditSeverity } from '../../src/types.js';
import { captureStdout } from './fixtures.js';

describe('markdownAuditReporter', () => {
  it('is re-exported from markdownReporter to preserve the public reporter API', () => {
    expect(reportAuditMarkdownFromMarkdownReporter).toBe(reportAuditMarkdown);
  });

  it('renders unavailable audits with the provided reason', async () => {
    const out = await captureStdout(() =>
      reportAuditMarkdown({
        available: false,
        reason: 'npm audit is unavailable',
        summary: emptySummary(),
        findings: [],
      }),
    );

    expect(out).toBe(['# Vulnerability Audit', '', '_npm audit is unavailable_'].join('\n'));
  });

  it('renders a clean audit result', async () => {
    const out = await captureStdout(() =>
      reportAuditMarkdown({
        available: true,
        summary: emptySummary(),
        findings: [],
      }),
    );

    expect(out).toContain('# Vulnerability Audit');
    expect(out).toContain('**0** findings - 0 critical · 0 high · 0 moderate · 0 low · 0 info');
    expect(out).toContain('_No known vulnerabilities._');
  });

  it('renders severity summary, linked and plain titles, and fix markers', async () => {
    const out = await captureStdout(() => reportAuditMarkdown(auditReport()));

    expect(out).toContain('**15** findings - 1 critical · 2 high · 3 moderate · 4 low · 5 info');
    expect(out).toContain('| Severity | Package | Title | Fix |');
    expect(out).toContain(
      '| critical | `critical-pkg` | [Critical issue](https://example.com/advisories/critical-pkg) | yes |',
    );
    expect(out).toContain('| low | `plain-pkg` | Plain issue | no |');
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
        fixAvailable: true,
      },
      {
        name: 'plain-pkg',
        severity: 'low',
        title: 'Plain issue',
        via: ['plain-pkg'],
        fixAvailable: false,
      },
    ],
  };
}
