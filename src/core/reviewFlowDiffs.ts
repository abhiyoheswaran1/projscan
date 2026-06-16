import { computeDataflow } from './dataflow.js';
import { isReviewBlockingDataflowRisk, isReviewBlockingFlow } from './reviewDataflow.js';
import type { ReviewFlowFilterContext } from './reviewDataflow.js';
import { computeTaint, type TaintFlow } from './taint.js';
import type { CodeGraph } from './codeGraph.js';
import { loadConfig } from '../utils/config.js';
import type { DataflowRisk } from '../types/graph.js';
import type { ReviewDataflowRisk, ReviewTaintFlow } from '../types/review.js';

interface ReviewFlowConfig {
  sources: string[];
  sinks: string[];
  filterContext: ReviewFlowFilterContext;
}

export async function computeNewTaintFlows(
  rootPath: string,
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
  touchedFiles: Set<string>,
): Promise<ReviewTaintFlow[]> {
  const flowConfig = await loadReviewFlowConfig(rootPath);
  const baseReport = computeTaint(baseGraph, flowConfig);
  const headReport = computeTaint(headGraph, flowConfig);
  if (!headReport.available) return [];
  const baseFlowKeys = new Set(
    baseReport.available ? baseReport.flows.map(reviewTaintFlowKey) : [],
  );
  const flows = headReport.flows
    .filter((flow) => isNewReviewTaintFlow(flow, baseFlowKeys, touchedFiles, flowConfig))
    .map(toReviewTaintFlow);
  return sortReviewTaintFlows(flows);
}

export async function computeNewDataflowRisks(
  rootPath: string,
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
  touchedFiles: Set<string>,
): Promise<ReviewDataflowRisk[]> {
  const flowConfig = await loadReviewFlowConfig(rootPath);
  const baseReport = computeDataflow(baseGraph, flowConfig);
  const headReport = computeDataflow(headGraph, flowConfig);
  if (!headReport.available) return [];
  const baseRiskKeys = new Set(
    baseReport.available ? baseReport.risks.map(reviewDataflowRiskKey) : [],
  );
  const risks = headReport.risks
    .filter((risk) => isNewReviewDataflowRisk(risk, baseRiskKeys, touchedFiles, flowConfig))
    .map(toReviewDataflowRisk);
  return sortReviewDataflowRisks(risks);
}

async function loadReviewFlowConfig(rootPath: string): Promise<ReviewFlowConfig> {
  const { config } = await loadConfig(rootPath);
  const sources = config.taint?.sources ?? [];
  const sinks = config.taint?.sinks ?? [];
  return {
    sources,
    sinks,
    filterContext: { customSources: new Set(sources), customSinks: new Set(sinks) },
  };
}

function isNewReviewTaintFlow(
  flow: TaintFlow,
  baseFlowKeys: Set<string>,
  touchedFiles: Set<string>,
  flowConfig: ReviewFlowConfig,
): boolean {
  if (baseFlowKeys.has(reviewTaintFlowKey(flow))) return false;
  if (!flow.files.some((f) => touchedFiles.has(f))) return false;
  return isReviewBlockingFlow(flow, flowConfig.filterContext);
}

function toReviewTaintFlow(flow: TaintFlow): ReviewTaintFlow {
  return {
    sourceFn: flow.sourceFn,
    sinkFn: flow.sinkFn,
    source: flow.source,
    sink: flow.sink,
    pathLength: flow.path.length,
    files: flow.files,
  };
}

function sortReviewTaintFlows(flows: ReviewTaintFlow[]): ReviewTaintFlow[] {
  return flows.sort((a, b) => {
    if (a.pathLength !== b.pathLength) return a.pathLength - b.pathLength;
    return a.sourceFn.localeCompare(b.sourceFn);
  });
}

function reviewTaintFlowKey(flow: {
  sourceFn: string;
  sinkFn: string;
  source: string;
  sink: string;
}): string {
  return `${flow.sourceFn}:${flow.sinkFn}:${flow.source}:${flow.sink}`;
}

function isNewReviewDataflowRisk(
  risk: DataflowRisk,
  baseRiskKeys: Set<string>,
  touchedFiles: Set<string>,
  flowConfig: ReviewFlowConfig,
): boolean {
  if (risk.kind !== 'bridge') return false;
  if (baseRiskKeys.has(reviewDataflowRiskKey(risk))) return false;
  if (!risk.files.some((f) => touchedFiles.has(f))) return false;
  return isReviewBlockingDataflowRisk(risk, flowConfig.filterContext);
}

function toReviewDataflowRisk(risk: DataflowRisk): ReviewDataflowRisk {
  return {
    kind: risk.kind,
    sourceFn: risk.sourceFn,
    sinkFn: risk.sinkFn,
    bridgeFn: risk.bridgeFn,
    source: risk.source,
    sink: risk.sink,
    pathLength: risk.pathLength,
    files: risk.files,
    severity: risk.severity,
    confidence: risk.confidence,
  };
}

function sortReviewDataflowRisks(risks: ReviewDataflowRisk[]): ReviewDataflowRisk[] {
  return risks.sort((a, b) => {
    if (a.pathLength !== b.pathLength) return a.pathLength - b.pathLength;
    return `${a.bridgeFn ?? ''}:${a.sourceFn}:${a.sinkFn}`.localeCompare(
      `${b.bridgeFn ?? ''}:${b.sourceFn}:${b.sinkFn}`,
    );
  });
}

function reviewDataflowRiskKey(risk: {
  kind: string;
  bridgeFn?: string;
  sourceFn: string;
  sinkFn: string;
  source: string;
  sink: string;
  files?: string[];
}): string {
  return `${risk.kind}:${risk.bridgeFn ?? ''}:${risk.sourceFn}:${risk.sinkFn}:${risk.source}:${risk.sink}:${risk.files?.join('|') ?? ''}`;
}
