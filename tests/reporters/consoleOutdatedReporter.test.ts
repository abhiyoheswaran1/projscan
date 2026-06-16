import { describe, it, expect } from 'vitest';
import { reportOutdated } from '../../src/reporters/consoleOutdatedReporter.js';
import { reportOutdated as reportOutdatedFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { OutdatedReport } from '../../src/types.js';
import { captureStdout, makeOutdatedReport, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

function report(overrides: Partial<OutdatedReport> = {}): OutdatedReport {
  return { ...makeOutdatedReport(), ...overrides };
}

describe('consoleOutdatedReporter', () => {
  it('renders unavailable outdated reports with the provided reason', async () => {
    const out = await capturePlain(() =>
      reportOutdated({
        available: false,
        reason: 'no package.json',
        totalPackages: 0,
        packages: [],
      }),
    );

    expect(out).toContain('no package.json');
    expect(out).not.toContain('Outdated Packages');
  });

  it('renders the clean all-matched message when nothing has drifted or is missing', async () => {
    const out = await capturePlain(() =>
      reportOutdated(
        report({
          totalPackages: 2,
          packages: [
            {
              name: 'react',
              declared: '^18.0.0',
              installed: '18.0.0',
              latest: '18.0.0',
              drift: 'same',
              scope: 'dependency',
            },
            {
              name: 'workspace-lib',
              declared: 'workspace:*',
              installed: '1.0.0',
              latest: null,
              drift: 'unknown',
              scope: 'dependency',
            },
          ],
        }),
      ),
    );

    expect(out).toContain('Outdated Packages');
    expect(out).toContain('2 declared');
    expect(out).toContain('0 drifted');
    expect(out).toContain('0 not installed');
    expect(out).toContain('All declared packages match installed versions.');
    expect(out).not.toContain('MAJOR');
    expect(out).not.toContain('Not installed');
  });

  it('groups major, minor, and patch drift while marking dev dependencies', async () => {
    const out = await capturePlain(() =>
      reportOutdated(
        report({
          totalPackages: 4,
          packages: [
            {
              name: 'react',
              declared: '^17.0.0',
              installed: '17.0.2',
              latest: '18.2.0',
              drift: 'major',
              scope: 'dependency',
            },
            {
              name: 'vite',
              declared: '^4.0.0',
              installed: '4.5.0',
              latest: '5.0.0',
              drift: 'minor',
              scope: 'devDependency',
            },
            {
              name: 'chalk',
              declared: '^5.0.0',
              installed: '5.0.1',
              latest: '5.0.2',
              drift: 'patch',
              scope: 'dependency',
            },
            {
              name: 'left-pad',
              declared: '^1.0.0',
              installed: '1.0.0',
              latest: '1.0.0',
              drift: 'same',
              scope: 'dependency',
            },
          ],
        }),
      ),
    );

    expect(out).toContain('4 declared');
    expect(out).toContain('3 drifted');
    expect(out).toContain('MAJOR (1)');
    expect(out).toContain('MINOR (1)');
    expect(out).toContain('PATCH (1)');
    expect(out).toContain('react');
    expect(out).toContain('vite');
    expect(out).toContain('[dev]');
    expect(out).toContain('chalk');
    expect(out).not.toContain('left-pad');
  });

  it('renders and truncates missing packages after 10 entries', async () => {
    const packages = Array.from({ length: 12 }, (_, index) => ({
      name: `missing-${String(index + 1).padStart(2, '0')}`,
      declared: '^1.0.0',
      installed: null,
      latest: null,
      drift: 'unknown' as const,
      scope: 'dependency' as const,
    }));
    const out = await capturePlain(() => reportOutdated(report({ totalPackages: 12, packages })));

    expect(out).toContain('12 declared');
    expect(out).toContain('0 drifted');
    expect(out).toContain('12 not installed');
    expect(out).toContain('Not installed (12)');
    expect(out).toContain('missing-01');
    expect(out).toContain('missing-10');
    expect(out).not.toContain('missing-11');
    expect(out).toContain('… and 2 more');
  });

  it('preserves the consoleReporter re-export for existing callers', async () => {
    const out = await capturePlain(() => reportOutdatedFromConsoleReporter(makeOutdatedReport()));

    expect(out).toContain('Outdated Packages');
    expect(out).toContain('react');
    expect(out).toContain('MAJOR');
  });
});
