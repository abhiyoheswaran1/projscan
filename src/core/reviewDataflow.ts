import { isGeneratedLikePath, isTestLikePath } from './pathClassifiers.js';

export interface ReviewFlowFilterContext {
  customSources: Set<string>;
  customSinks: Set<string>;
}

export function isReviewBlockingFlow(
  flow: { source: string; sink: string; files: string[] },
  context: ReviewFlowFilterContext,
): boolean {
  if (flow.files.some(isTestLikePath)) return false;
  if (isDefaultGeneratedCodeFlow(flow, context)) return false;
  return true;
}

export function isReviewBlockingDataflowRisk(
  risk: { source: string; sink: string; files: string[] },
  context: ReviewFlowFilterContext,
): boolean {
  if (!isReviewBlockingFlow(risk, context)) return false;
  if (BROAD_FILE_IO_REVIEW_SOURCES.has(risk.source)) return false;
  if (BROAD_FILE_IO_REVIEW_SINKS.has(risk.sink)) return false;
  return true;
}

function isDefaultGeneratedCodeFlow(
  flow: { source: string; sink: string; files: string[] },
  context: ReviewFlowFilterContext,
): boolean {
  if (!flow.files.some(isGeneratedLikePath)) return false;
  return !context.customSources.has(flow.source) && !context.customSinks.has(flow.sink);
}

const BROAD_FILE_IO_REVIEW_SOURCES = new Set(['readFile', 'readFileSync']);
const BROAD_FILE_IO_REVIEW_SINKS = new Set(['writeFile', 'writeFileSync', 'unlink', 'rm', 'rmSync']);
