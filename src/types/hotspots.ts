export interface AuthorShare {
  author: string;
  commits: number;
  share: number;
}

export interface FileHotspot {
  relativePath: string;
  churn: number;
  distinctAuthors: number;
  daysSinceLastChange: number | null;
  lineCount: number;
  /** AST-derived McCabe complexity. null when no language adapter parsed this file. */
  cyclomaticComplexity: number | null;
  sizeBytes: number;
  issueCount: number;
  issueIds: string[];
  riskScore: number;
  reasons: string[];
  primaryAuthor: string | null;
  primaryAuthorShare: number;
  busFactorOne: boolean;
  topAuthors: AuthorShare[];
  coverage?: number | null;
  /**
   * 1.5+ - true when Project Memory has marked this file as
   * "accepted load-bearing debt" (top-K hotspot for >= 5 runs over
   * >= 7 days without CC/churn improving). The reporter tags accepted
   * rows so users aren't repeatedly pestered about debt they've
   * implicitly opted into. Absent on older saves / fresh runs.
   */
  accepted?: boolean;
}

export interface HotspotReport {
  available: boolean;
  reason?: string;
  window: { since: string | null; commitsScanned: number };
  hotspots: FileHotspot[];
  totalFilesRanked: number;
}
