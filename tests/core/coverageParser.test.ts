import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseCoverage, coverageMap } from '../../src/core/coverageParser.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-coverage-'));
}

describe('parseCoverage', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
    await fs.mkdir(path.join(tmp, 'coverage'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns unavailable when no coverage file exists', async () => {
    await fs.rm(path.join(tmp, 'coverage'), { recursive: true });
    const report = await parseCoverage(tmp);
    expect(report.available).toBe(false);
    expect(report.reason).toMatch(/No coverage file/);
  });

  it('parses lcov.info', async () => {
    const lcov = [
      'TN:',
      `SF:${tmp}/src/a.ts`,
      'DA:1,1',
      'DA:2,0',
      'LF:10',
      'LH:7',
      'end_of_record',
      `SF:${tmp}/src/b.ts`,
      'LF:4',
      'LH:4',
      'end_of_record',
      '',
    ].join('\n');
    await fs.writeFile(path.join(tmp, 'coverage', 'lcov.info'), lcov);

    const report = await parseCoverage(tmp);
    expect(report.available).toBe(true);
    expect(report.source).toBe('lcov');
    expect(report.files).toHaveLength(2);

    const a = report.files.find((f) => f.relativePath === 'src/a.ts');
    expect(a?.linesFound).toBe(10);
    expect(a?.linesHit).toBe(7);
    expect(a?.lineCoverage).toBe(70);

    const b = report.files.find((f) => f.relativePath === 'src/b.ts');
    expect(b?.lineCoverage).toBe(100);

    // 11/14 total
    expect(report.totalCoverage).toBeCloseTo((11 / 14) * 100, 1);
  });

  it('parses coverage-summary.json', async () => {
    await fs.writeFile(
      path.join(tmp, 'coverage', 'coverage-summary.json'),
      JSON.stringify({
        total: { lines: { total: 100, covered: 80, pct: 80 } },
        [`${tmp}/src/a.ts`]: { lines: { total: 10, covered: 5, pct: 50 } },
        [`${tmp}/src/b.ts`]: { lines: { total: 20, covered: 20, pct: 100 } },
      }),
    );

    const report = await parseCoverage(tmp);
    expect(report.available).toBe(true);
    expect(report.source).toBe('coverage-summary');
    expect(report.files).toHaveLength(2);
    expect(report.files.find((f) => f.relativePath === 'src/a.ts')?.lineCoverage).toBe(50);
  });

  it('parses coverage-final.json', async () => {
    await fs.writeFile(
      path.join(tmp, 'coverage', 'coverage-final.json'),
      JSON.stringify({
        [`${tmp}/src/a.ts`]: {
          path: `${tmp}/src/a.ts`,
          statementMap: { '0': {}, '1': {}, '2': {} },
          s: { '0': 3, '1': 0, '2': 1 }, // 2 out of 3 hit
        },
      }),
    );

    const report = await parseCoverage(tmp);
    expect(report.available).toBe(true);
    expect(report.source).toBe('coverage-final');
    expect(report.files[0].linesFound).toBe(3);
    expect(report.files[0].linesHit).toBe(2);
    expect(report.files[0].lineCoverage).toBeCloseTo(66.67, 1);
  });

  it('builds a fast lookup map', async () => {
    const lcov = [`SF:${tmp}/src/a.ts`, 'LF:10', 'LH:5', 'end_of_record', ''].join('\n');
    await fs.writeFile(path.join(tmp, 'coverage', 'lcov.info'), lcov);
    const report = await parseCoverage(tmp);
    const map = coverageMap(report);
    expect(map.get('src/a.ts')).toBe(50);
    expect(map.get('nope')).toBeUndefined();
  });
});
