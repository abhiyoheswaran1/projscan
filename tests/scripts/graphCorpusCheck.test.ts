import { describe, expect, it } from 'vitest';
import { compareGraphCorpus } from '../../scripts/check-graph-corpus.mjs';

describe('graph corpus baseline check', () => {
  it('passes when current metrics meet baseline minimums', () => {
    const report = compareGraphCorpus(
      {
        schemaVersion: 1,
        fixtures: [
          {
            name: 'ts-small',
            fixture: 'tests/fixtures/ts-small',
            files: 1,
            functions: 2,
            packages: 0,
            symbols: 1,
            importEdges: 0,
            callEdges: 1,
            dataflowRisks: 0,
          },
        ],
        totals: {
          files: 1,
          functions: 2,
          packages: 0,
          symbols: 1,
          importEdges: 0,
          callEdges: 1,
          dataflowRisks: 0,
        },
      },
      {
        schemaVersion: 1,
        fixtures: [
          {
            name: 'ts-small',
            fixture: 'tests/fixtures/ts-small',
            files: 1,
            functions: 3,
            packages: 0,
            symbols: 1,
            importEdges: 0,
            callEdges: 2,
            dataflowRisks: 0,
          },
        ],
        totals: {
          files: 1,
          functions: 3,
          packages: 0,
          symbols: 1,
          importEdges: 0,
          callEdges: 2,
          dataflowRisks: 0,
        },
      },
    );

    expect(report.status).toBe('pass');
    expect(report.failures).toEqual([]);
  });

  it('fails only meaningful regressions below baseline or above risk cap', () => {
    const report = compareGraphCorpus(
      {
        schemaVersion: 1,
        fixtures: [
          {
            name: 'ts-small',
            fixture: 'tests/fixtures/ts-small',
            files: 2,
            functions: 3,
            packages: 0,
            symbols: 2,
            importEdges: 1,
            callEdges: 2,
            dataflowRisks: 0,
          },
        ],
        totals: {
          files: 2,
          functions: 3,
          packages: 0,
          symbols: 2,
          importEdges: 1,
          callEdges: 2,
          dataflowRisks: 0,
        },
      },
      {
        schemaVersion: 1,
        fixtures: [
          {
            name: 'ts-small',
            fixture: 'tests/fixtures/ts-small',
            files: 2,
            functions: 2,
            packages: 0,
            symbols: 2,
            importEdges: 1,
            callEdges: 2,
            dataflowRisks: 1,
          },
        ],
        totals: {
          files: 2,
          functions: 2,
          packages: 0,
          symbols: 2,
          importEdges: 1,
          callEdges: 2,
          dataflowRisks: 1,
        },
      },
    );

    expect(report.status).toBe('fail');
    expect(report.failures.map((failure) => failure.metric)).toEqual([
      'functions',
      'dataflowRisks',
    ]);
  });
});
