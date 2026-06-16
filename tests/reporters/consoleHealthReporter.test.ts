import { describe, it, expect } from 'vitest';
import {
  reportHealth,
  type ReportHealthOptions,
} from '../../src/reporters/consoleHealthReporter.js';
import { reportHealth as reportHealthFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import { captureStdout, makeIssue, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

describe('consoleHealthReporter', () => {
  it('renders score, issue summary, details, suggestions, and next commands', async () => {
    const issues = [
      makeIssue({
        id: 'error-one',
        severity: 'error',
        title: 'Broken build',
        description: 'Build command exits non-zero.',
        suggestedAction: { summary: 'Run the build locally' },
      }),
      makeIssue({
        id: 'warning-one',
        severity: 'warning',
        title: 'Missing docs',
        description: 'No guide found.',
        fixAvailable: true,
        fixId: 'add-guide',
      }),
      makeIssue({
        id: 'info-one',
        severity: 'info',
        title: 'Nice-to-have',
        description: 'Consider adding examples.',
      }),
    ];

    const out = await capturePlain(() => reportHealth(issues, 500));

    expect(out).toContain('Project Health Report');
    expect(out).toContain('Health Score');
    expect(out).toMatch(/\d+\/100/);
    expect(out).toContain('1 error');
    expect(out).toContain('1 warning');
    expect(out).toContain('1 info');
    expect(out).toContain('500ms');
    expect(out).toContain('Broken build');
    expect(out).toContain('Build command exits non-zero.');
    expect(out).toContain('Run the build locally');
    expect(out).toContain('projscan fix-suggest error-one');
    expect(out).toContain('Recommendations');
    expect(out).toContain('Fix: Missing docs');
    expect(out).toContain('projscan fix');
    expect(out).toContain('Next best commands');
    expect(out).toContain('projscan preflight --mode before_edit --format json');
    expect(out).toContain('projscan bug-hunt --format json');
    expect(out).toContain('projscan recipes');
  });

  it('shows the healthy message and exits early when no issues are present', async () => {
    const out = await capturePlain(() => reportHealth([]));

    expect(out.toLowerCase()).toContain('no issues detected');
    expect(out).not.toContain('Issues Detected');
    expect(out).not.toContain('Next best commands');
  });

  it('accepts options objects and renders stable-rule memory guidance', async () => {
    const options: ReportHealthOptions = { scanTimeMs: 321, stableRuleCount: 2 };
    const out = await capturePlain(() => reportHealth([makeIssue()], options));

    expect(out).toContain('321ms');
    expect(out).toContain('2 rules have been open');
    expect(out).toContain('projscan memory stable');
  });

  it('preserves the consoleReporter re-export for existing callers', async () => {
    const out = await capturePlain(() =>
      reportHealthFromConsoleReporter([makeIssue()], { stableRuleCount: 1 }),
    );

    expect(out).toContain('Project Health Report');
    expect(out).toContain('1 rule has been open');
  });
});
