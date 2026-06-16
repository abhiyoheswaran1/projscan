export interface GraphCorpusFixtureMetrics {
  name: string;
  fixture: string;
  files: number;
  functions: number;
  packages: number;
  symbols: number;
  importEdges: number;
  callEdges: number;
  dataflowRisks: number;
}

export interface GraphCorpusReport {
  schemaVersion: 1;
  fixtures: GraphCorpusFixtureMetrics[];
  totals: Omit<GraphCorpusFixtureMetrics, 'name' | 'fixture'>;
}
