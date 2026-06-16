import { describe, it, expect } from 'vitest';
import { reportDependencies } from '../../src/reporters/consoleDependencyReporter.js';
import { reportDependencies as reportDependenciesFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { DependencyReport } from '../../src/types.js';
import { captureStdout, makeDependencyReport, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

function manyProductionDependencies(count: number): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `dep-${String(index + 1).padStart(2, '0')}`,
      `^${index + 1}.0.0`,
    ]),
  );
}

describe('consoleDependencyReporter', () => {
  it('renders totals, sorted dependencies, licenses, sizes, and risks', async () => {
    const report = makeDependencyReport();
    report.dependencies = { zeta: '^1.0.0', alpha: '^2.0.0' };
    report.risks = [
      { name: 'alpha', reason: 'known exploit', severity: 'high' },
      { name: 'zeta', reason: 'large install footprint', severity: 'medium' },
    ];

    const out = await capturePlain(() => reportDependencies(report));

    expect(out).toContain('Dependency Report');
    expect(out).toContain('Production:');
    expect(out).toContain('2 packages');
    expect(out).toContain('Development:');
    expect(out).toContain('1 packages');
    expect(out.indexOf('alpha ^2.0.0')).toBeLessThan(out.indexOf('zeta ^1.0.0'));
    expect(out).toContain('License Summary');
    expect(out).toContain('Known:');
    expect(out).toContain('MIT: 3');
    expect(out).toContain('Installed Package Sizes');
    expect(out).toContain('Total:');
    expect(out).toContain('lodash');
    expect(out).toContain('Risks');
    expect(out).toContain('alpha: known exploit');
    expect(out).toContain('zeta: large install footprint');
  });

  it('truncates production dependencies after 25 rows', async () => {
    const report = makeDependencyReport();
    report.dependencies = manyProductionDependencies(27);
    report.totalDependencies = 27;

    const out = await capturePlain(() => reportDependencies(report));

    expect(out).toContain('dep-01 ^1.0.0');
    expect(out).toContain('dep-25 ^25.0.0');
    expect(out).not.toContain('dep-26 ^26.0.0');
    expect(out).toContain('... and 2 more');
  });

  it('omits optional sections when no optional dependency evidence exists', async () => {
    const minimal: DependencyReport = {
      totalDependencies: 0,
      totalDevDependencies: 0,
      dependencies: {},
      devDependencies: {},
      risks: [],
    };

    const out = await capturePlain(() => reportDependencies(minimal));

    expect(out).toContain('Dependency Report');
    expect(out).toContain('Total:');
    expect(out).toContain('0 packages');
    expect(out).not.toContain('Production Dependencies');
    expect(out).not.toContain('License Summary');
    expect(out).not.toContain('Installed Package Sizes');
    expect(out).not.toContain('Risks');
  });

  it('preserves the consoleReporter re-export for existing callers', async () => {
    const out = await capturePlain(() =>
      reportDependenciesFromConsoleReporter(makeDependencyReport()),
    );

    expect(out).toContain('Dependency Report');
    expect(out).toContain('License Summary');
  });
});
