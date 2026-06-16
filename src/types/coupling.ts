export interface FileCoupling {
  relativePath: string;
  /** Number of files that import this one. */
  fanIn: number;
  /** Number of locally-resolved imports this file makes. */
  fanOut: number;
  /** Bob Martin's instability: fanOut / (fanIn + fanOut). 0 when both are zero. */
  instability: number;
}

export interface ImportCycle {
  /** Member files of a strongly-connected component (size >= 2). */
  files: string[];
  size: number;
}

export interface CrossPackageEdge {
  /** Importing file + the workspace package it belongs to. */
  from: { file: string; package: string };
  /** Imported file + the workspace package it belongs to. */
  to: { file: string; package: string };
}

export interface CouplingReport {
  files: FileCoupling[];
  cycles: ImportCycle[];
  /**
   * Edges where importer and imported live in different workspace packages
   * (0.11). Empty when no workspace info was supplied or when all edges are
   * intra-package. Useful for spotting unauthorized deep imports across
   * package boundaries.
   */
  crossPackageEdges: CrossPackageEdge[];
  totalFiles: number;
  totalCycles: number;
  totalCrossPackageEdges: number;
}
