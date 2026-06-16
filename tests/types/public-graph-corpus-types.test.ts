import { expect, test } from 'vitest';
import '../../src/types/graphCorpus.js';
import type { GraphCorpusFixtureMetrics, GraphCorpusReport } from '../../src/types/graphCorpus.js';
import type {
  GraphCorpusFixtureMetrics as BarrelGraphCorpusFixtureMetrics,
  GraphCorpusReport as BarrelGraphCorpusReport,
} from '../../src/types.js';

const fixtureMetrics: GraphCorpusFixtureMetrics = {
  name: 'sample-project',
  fixture: 'tests/fixtures/sample-project',
  files: 3,
  functions: 5,
  packages: 1,
  symbols: 8,
  importEdges: 4,
  callEdges: 6,
  dataflowRisks: 0,
};

const report: GraphCorpusReport = {
  schemaVersion: 1,
  fixtures: [fixtureMetrics],
  totals: {
    files: fixtureMetrics.files,
    functions: fixtureMetrics.functions,
    packages: fixtureMetrics.packages,
    symbols: fixtureMetrics.symbols,
    importEdges: fixtureMetrics.importEdges,
    callEdges: fixtureMetrics.callEdges,
    dataflowRisks: fixtureMetrics.dataflowRisks,
  },
};

const barrelFixtureMetrics: BarrelGraphCorpusFixtureMetrics = fixtureMetrics;
const barrelReport: BarrelGraphCorpusReport = report;
const moduleReport: GraphCorpusReport = barrelReport;

test('graph corpus public types compile from the module and legacy barrel', () => {
  expect(barrelFixtureMetrics.name).toBe('sample-project');
  expect(moduleReport.schemaVersion).toBe(1);
  expect(moduleReport.fixtures).toEqual([fixtureMetrics]);
  expect(moduleReport.totals.functions).toBe(5);
});
