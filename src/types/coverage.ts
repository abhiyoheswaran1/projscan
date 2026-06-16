export type CoverageSource = 'lcov' | 'coverage-final' | 'coverage-summary';

export interface FileCoverage {
  relativePath: string;
  lineCoverage: number;
  linesFound: number;
  linesHit: number;
}

export interface CoverageReport {
  available: boolean;
  reason?: string;
  source: CoverageSource | null;
  sourceFile: string | null;
  totalCoverage: number;
  files: FileCoverage[];
}

export interface CoverageJoinedHotspot {
  relativePath: string;
  riskScore: number;
  churn: number;
  lineCount: number;
  issueCount: number;
  coverage: number | null;
  priority: number;
  reasons: string[];
}

export interface CoverageJoinedReport {
  available: boolean;
  reason?: string;
  coverageSource: CoverageSource | null;
  coverageSourceFile: string | null;
  entries: CoverageJoinedHotspot[];
}
