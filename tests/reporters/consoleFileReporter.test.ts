import { describe, expect, it } from 'vitest';
import { reportFileInspection } from '../../src/reporters/consoleFileReporter.js';
import { reportFileInspection as reportFileInspectionFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import { captureStdout, makeFileInspection, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

describe('consoleFileReporter', () => {
  it('renders unavailable files with the provided reason', async () => {
    const out = await capturePlain(() =>
      reportFileInspection(
        makeFileInspection({
          exists: false,
          reason: 'not found',
          imports: [],
          exports: [],
          potentialIssues: [],
          hotspot: null,
          issues: [],
          functions: [],
        }),
      ),
    );

    expect(out).toContain('File Report');
    expect(out).toContain('not found');
  });

  it('renders file summary, hotspot risk, issues, imports, exports, and functions', async () => {
    const out = await capturePlain(() => reportFileInspection(makeFileInspection()));

    expect(out).toContain('File Report');
    expect(out).toContain('src/big.ts');
    expect(out).toContain('Source module');
    expect(out).toContain('1.5 KB');
    expect(out).toContain('fan-in 2, fan-out 7');
    expect(out).toContain('Risk Score:');
    expect(out).toContain('85.0');
    expect(out).toContain('primary: alice, 75%');
    expect(out).toContain('Bus factor 1');
    expect(out).toContain('Missing README');
    expect(out).toContain('(local) ./local.js');
    expect(out).toContain('(package) chalk');
    expect(out).toContain('run (function)');
    expect(out).toContain('CC  12');
    expect(out).toContain('riskier L10-30');
  });

  it('truncates long dependency and function lists', async () => {
    const imports = Array.from({ length: 22 }, (_, index) => ({
      source: `pkg-${index + 1}`,
      specifiers: [],
      isRelative: false,
    }));
    const functions = Array.from({ length: 12 }, (_, index) => ({
      name: `fn${index + 1}`,
      line: index + 1,
      endLine: index + 2,
      cyclomaticComplexity: index + 1,
      fanIn: index,
    }));

    const out = await capturePlain(() =>
      reportFileInspection(makeFileInspection({ imports, functions })),
    );

    expect(out).toContain('pkg-20');
    expect(out).not.toContain('pkg-21');
    expect(out).toContain('... and 2 more');
    expect(out).toContain('fn10');
    expect(out).not.toContain('fn11');
    expect(out).toContain('... and 2 more');
  });

  it('preserves the consoleReporter re-export for existing callers', async () => {
    const out = await capturePlain(() =>
      reportFileInspectionFromConsoleReporter(makeFileInspection()),
    );

    expect(out).toContain('File Report');
    expect(out).toContain('src/big.ts');
  });
});
