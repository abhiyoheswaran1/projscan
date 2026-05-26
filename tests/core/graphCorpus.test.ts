import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { computeGraphCorpus } from '../../src/core/graphCorpus.js';

describe('computeGraphCorpus', () => {
  it('computes deterministic graph quality metrics for bundled language fixtures', async () => {
    const fixtures = [
      'python-small',
      'go-small',
      'rust-small',
      'php-small',
      'csharp-small',
      'kotlin-small',
      'cpp-small',
      'swift-small',
    ].map((name) => path.join('tests', 'fixtures', name));

    const report = await computeGraphCorpus(process.cwd(), { fixtures });

    expect(report.schemaVersion).toBe(1);
    expect(report.fixtures.map((fixture) => fixture.name)).toEqual([
      'cpp-small',
      'csharp-small',
      'go-small',
      'kotlin-small',
      'php-small',
      'python-small',
      'rust-small',
      'swift-small',
    ]);
    for (const fixture of report.fixtures) {
      expect(fixture.files).toBeGreaterThan(0);
      expect(fixture.functions).toBeGreaterThan(0);
      expect(fixture).toEqual(
        expect.objectContaining({
          importEdges: expect.any(Number),
          callEdges: expect.any(Number),
          dataflowRisks: expect.any(Number),
          symbols: expect.any(Number),
          packages: expect.any(Number),
        }),
      );
    }
    expect(report.totals.files).toBeGreaterThan(0);
    expect(report.totals.functions).toBeGreaterThan(0);
  });
});
