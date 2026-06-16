import { describe, it, expect } from 'vitest';
import { reportOutdatedMarkdown } from '../../src/reporters/markdownOutdatedReporter.js';
import { reportOutdatedMarkdown as reportOutdatedMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import { captureStdout, makeOutdatedReport } from './fixtures.js';

describe('markdownOutdatedReporter', () => {
  it('preserves the markdownReporter re-export for existing callers', () => {
    expect(reportOutdatedMarkdownFromMarkdownReporter).toBe(reportOutdatedMarkdown);
  });

  it('shows the unavailable reason', async () => {
    const out = await captureStdout(() =>
      reportOutdatedMarkdown({
        available: false,
        reason: 'npm unavailable',
        totalPackages: 0,
        packages: [],
      }),
    );

    expect(out).toContain('# Outdated Packages');
    expect(out).toContain('_npm unavailable_');
  });

  it('renders drifted package rows and omits same-version packages', async () => {
    const report = makeOutdatedReport();
    report.packages.push({
      name: 'vitest',
      declared: '^4.0.0',
      installed: '4.0.0',
      latest: '4.0.0',
      drift: 'same',
      scope: 'devDependency',
    });
    report.totalPackages = 2;

    const out = await captureStdout(() => reportOutdatedMarkdown(report));

    expect(out).toContain('**2** declared · **1** drifted');
    expect(out).toContain('| Package | Scope | Declared | Installed | Drift |');
    expect(out).toContain('| `react` | prod | ^17.0.0 | 17.0.2 | major |');
    expect(out).not.toContain('vitest');
  });

  it('renders the healthy message when nothing drifts', async () => {
    const out = await captureStdout(() =>
      reportOutdatedMarkdown({ available: true, totalPackages: 0, packages: [] }),
    );

    expect(out).toContain('_All declared packages match installed versions._');
  });
});
