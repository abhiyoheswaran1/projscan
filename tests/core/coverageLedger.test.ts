import { describe, it, expect } from 'vitest';
import { computeCoverageLedger } from '../../src/core/coverageLedger.js';
import type { FileEntry } from '../../src/types.js';

function entry(relativePath: string): FileEntry {
  const ext = relativePath.slice(relativePath.lastIndexOf('.')).toLowerCase();
  return {
    relativePath,
    absolutePath: `/repo/${relativePath}`,
    extension: ext,
    sizeBytes: 100,
    directory: relativePath.includes('/') ? relativePath.replace(/\/[^/]+$/, '') : '.',
  };
}

describe('computeCoverageLedger', () => {
  it('counts files an adapter can parse as analyzed', () => {
    const ledger = computeCoverageLedger([entry('src/a.ts'), entry('src/b.py')]);
    expect(ledger.analyzedFiles).toBe(2);
    expect(ledger.blindSpots).toEqual([]);
  });

  it('reports code files with no adapter as blind spots, grouped by extension', () => {
    const ledger = computeCoverageLedger([
      entry('src/a.ts'),
      entry('lib/one.dart'),
      entry('lib/two.dart'),
      entry('app/view.erb'),
    ]);
    expect(ledger.analyzedFiles).toBe(1);
    expect(ledger.blindSpotFiles).toBe(3);
    expect(ledger.blindSpots).toEqual([
      { extension: '.dart', fileCount: 2 },
      { extension: '.erb', fileCount: 1 },
    ]);
  });

  it('ignores non-code files so the ledger stays signal, not noise', () => {
    const ledger = computeCoverageLedger([
      entry('src/a.ts'),
      entry('README.md'),
      entry('logo.png'),
      entry('package-lock.json'),
    ]);
    expect(ledger.blindSpots).toEqual([]);
    expect(ledger.blindSpotFiles).toBe(0);
  });

  it('treats an import-carrying blind spot as weakening reachability claims', () => {
    const withDart = computeCoverageLedger([entry('src/a.ts'), entry('lib/one.dart')]);
    expect(withDart.weakensReachability).toBe(true);

    const clean = computeCoverageLedger([entry('src/a.ts')]);
    expect(clean.weakensReachability).toBe(false);
  });

  it('does not weaken reachability for blind spots that cannot import project code', () => {
    const ledger = computeCoverageLedger([entry('src/a.ts'), entry('db/schema.sql')]);
    expect(ledger.blindSpotFiles).toBe(1);
    expect(ledger.weakensReachability).toBe(false);
  });

  it('orders blind spots by impact, largest first', () => {
    const ledger = computeCoverageLedger([
      entry('a.erb'),
      entry('b.dart'),
      entry('c.dart'),
      entry('d.dart'),
    ]);
    expect(ledger.blindSpots[0]).toEqual({ extension: '.dart', fileCount: 3 });
  });

  it('sees component files now that an adapter claims them', () => {
    const ledger = computeCoverageLedger([entry('src/pages/index.astro')]);
    expect(ledger.analyzedFiles).toBe(1);
    expect(ledger.blindSpots).toEqual([]);
  });
});
