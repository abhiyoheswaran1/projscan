import { expect, test } from 'vitest';
import type {
  DataflowReport,
  DataflowRisk,
  DataflowRiskConfidence,
  DataflowRiskKind,
  DataflowRiskSeverity,
  GraphEvidenceSummary,
  SemanticGraphEdge,
  SemanticGraphEdgeKind,
  SemanticGraphNode,
  SemanticGraphNodeKind,
  SemanticGraphReport,
} from '../../src/types/graph.js';
import type {
  DataflowReport as BarrelDataflowReport,
  DataflowRisk as BarrelDataflowRisk,
  DataflowRiskConfidence as BarrelDataflowRiskConfidence,
  DataflowRiskKind as BarrelDataflowRiskKind,
  DataflowRiskSeverity as BarrelDataflowRiskSeverity,
  GraphEvidenceSummary as BarrelGraphEvidenceSummary,
  SemanticGraphEdge as BarrelSemanticGraphEdge,
  SemanticGraphEdgeKind as BarrelSemanticGraphEdgeKind,
  SemanticGraphNode as BarrelSemanticGraphNode,
  SemanticGraphNodeKind as BarrelSemanticGraphNodeKind,
  SemanticGraphReport as BarrelSemanticGraphReport,
} from '../../src/types.js';

const graphEvidence: GraphEvidenceSummary = {
  schemaVersion: 1,
  changedFiles: 2,
  changedFunctions: 3,
  totalFunctions: 10,
  totalPackages: 2,
  totalCallEdges: 12,
  dataflowRisks: 1,
  topPackages: ['projscan'],
};

const nodeKind: SemanticGraphNodeKind = 'function';
const graphNode: SemanticGraphNode = {
  id: 'src/index.ts#main',
  kind: nodeKind,
  label: 'main',
  file: 'src/index.ts',
  line: 1,
  endLine: 4,
  adapterId: 'javascript',
  metrics: {
    lineCount: 4,
    cyclomaticComplexity: 1,
    fanIn: 0,
    fanOut: 1,
  },
};

const edgeKind: SemanticGraphEdgeKind = 'calls';
const graphEdge: SemanticGraphEdge = {
  from: graphNode.id,
  to: 'src/core/review.ts#computeReview',
  kind: edgeKind,
  label: 'computeReview',
};

const semanticGraph: SemanticGraphReport = {
  schemaVersion: 3,
  nodes: [graphNode],
  edges: [graphEdge],
  metrics: {
    totalFiles: 1,
    totalFunctions: 1,
    totalPackages: 1,
    totalSymbols: 1,
    totalEdges: 1,
  },
  truncated: false,
  limits: {
    maxNodes: 1000,
    maxEdges: 2000,
  },
};

const riskKind: DataflowRiskKind = 'bridge';
const riskSeverity: DataflowRiskSeverity = 'warning';
const riskConfidence: DataflowRiskConfidence = 'high';
const dataflowRisk: DataflowRisk = {
  key: 'source->sink',
  kind: riskKind,
  severity: riskSeverity,
  confidence: riskConfidence,
  sourceFn: 'readSecret',
  sinkFn: 'sendNetwork',
  bridgeFn: 'pipeSecret',
  source: 'env',
  sink: 'network',
  path: ['readSecret', 'pipeSecret', 'sendNetwork'],
  sourcePath: ['readSecret'],
  sinkPath: ['sendNetwork'],
  pathLength: 3,
  files: ['src/secrets.ts', 'src/network.ts'],
};

const dataflowReport: DataflowReport = {
  available: true,
  riskCount: 1,
  risks: [dataflowRisk],
  effectiveSources: ['env'],
  effectiveSinks: ['network'],
  truncated: false,
  truncatedSources: [],
  maxDepth: 4,
};

const barrelGraphEvidence: BarrelGraphEvidenceSummary = graphEvidence;
const barrelNodeKind: BarrelSemanticGraphNodeKind = nodeKind;
const barrelGraphNode: BarrelSemanticGraphNode = {
  id: graphNode.id,
  kind: barrelNodeKind,
  label: graphNode.label,
  file: graphNode.file,
  line: graphNode.line,
  endLine: graphNode.endLine,
  adapterId: graphNode.adapterId,
  metrics: graphNode.metrics,
};
const barrelEdgeKind: BarrelSemanticGraphEdgeKind = edgeKind;
const barrelGraphEdge: BarrelSemanticGraphEdge = {
  from: barrelGraphNode.id,
  to: graphEdge.to,
  kind: barrelEdgeKind,
  label: graphEdge.label,
};
const barrelSemanticGraph: BarrelSemanticGraphReport = {
  schemaVersion: semanticGraph.schemaVersion,
  nodes: [barrelGraphNode],
  edges: [barrelGraphEdge],
  metrics: semanticGraph.metrics,
  truncated: semanticGraph.truncated,
  limits: semanticGraph.limits,
};
const barrelRiskKind: BarrelDataflowRiskKind = riskKind;
const barrelRiskSeverity: BarrelDataflowRiskSeverity = riskSeverity;
const barrelRiskConfidence: BarrelDataflowRiskConfidence = riskConfidence;
const barrelDataflowRisk: BarrelDataflowRisk = {
  key: dataflowRisk.key,
  kind: barrelRiskKind,
  severity: barrelRiskSeverity,
  confidence: barrelRiskConfidence,
  sourceFn: dataflowRisk.sourceFn,
  sinkFn: dataflowRisk.sinkFn,
  bridgeFn: dataflowRisk.bridgeFn,
  source: dataflowRisk.source,
  sink: dataflowRisk.sink,
  path: dataflowRisk.path,
  sourcePath: dataflowRisk.sourcePath,
  sinkPath: dataflowRisk.sinkPath,
  pathLength: dataflowRisk.pathLength,
  files: dataflowRisk.files,
};
const barrelDataflowReport: BarrelDataflowReport = {
  available: dataflowReport.available,
  reason: dataflowReport.reason,
  riskCount: dataflowReport.riskCount,
  risks: [barrelDataflowRisk],
  effectiveSources: dataflowReport.effectiveSources,
  effectiveSinks: dataflowReport.effectiveSinks,
  truncated: dataflowReport.truncated,
  truncatedSources: dataflowReport.truncatedSources,
  maxDepth: dataflowReport.maxDepth,
};

void [
  barrelGraphEvidence,
  barrelGraphNode,
  barrelGraphEdge,
  barrelSemanticGraph,
  barrelDataflowRisk,
  barrelDataflowReport,
];

test('graph public types compile from the module and legacy barrel', () => {
  expect(barrelDataflowReport.risks).toHaveLength(1);
});
