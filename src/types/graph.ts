export interface GraphEvidenceSummary {
  schemaVersion: 1;
  changedFiles?: number;
  changedFunctions?: number;
  totalFunctions: number;
  totalPackages: number;
  totalCallEdges: number;
  dataflowRisks: number;
  topPackages: string[];
}

export type SemanticGraphNodeKind = 'file' | 'function' | 'package' | 'symbol';

export interface SemanticGraphNode {
  id: string;
  kind: SemanticGraphNodeKind;
  label: string;
  file?: string;
  line?: number;
  endLine?: number;
  adapterId?: string;
  metrics?: {
    lineCount?: number;
    cyclomaticComplexity?: number;
    fanIn?: number;
    fanOut?: number;
  };
}

export type SemanticGraphEdgeKind = 'defines' | 'imports' | 'imports_package' | 'exports' | 'calls';

export interface SemanticGraphEdge {
  from: string;
  to: string;
  kind: SemanticGraphEdgeKind;
  label?: string;
}

export interface SemanticGraphReport {
  schemaVersion: 3;
  nodes: SemanticGraphNode[];
  edges: SemanticGraphEdge[];
  metrics: {
    totalFiles: number;
    totalFunctions: number;
    totalPackages: number;
    totalSymbols: number;
    totalEdges: number;
  };
  truncated: boolean;
  limits: {
    maxNodes: number;
    maxEdges: number;
  };
}

export type DataflowRiskKind = 'direct' | 'propagated' | 'bridge';
export type DataflowRiskSeverity = 'warning' | 'error';
export type DataflowRiskConfidence = 'low' | 'medium' | 'high';

export interface DataflowRisk {
  key: string;
  kind: DataflowRiskKind;
  severity: DataflowRiskSeverity;
  confidence: DataflowRiskConfidence;
  sourceFn: string;
  sinkFn: string;
  bridgeFn?: string;
  source: string;
  sink: string;
  path: string[];
  sourcePath?: string[];
  sinkPath?: string[];
  pathLength: number;
  files: string[];
}

export interface DataflowReport {
  available: boolean;
  reason?: string;
  riskCount: number;
  risks: DataflowRisk[];
  effectiveSources: string[];
  effectiveSinks: string[];
  truncated?: boolean;
  truncatedSources?: string[];
  maxDepth?: number;
}
