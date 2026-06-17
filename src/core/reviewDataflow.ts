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
  if (isDefaultTelemetryOptInStorageFlow(flow, context)) return false;
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

function isDefaultTelemetryOptInStorageFlow(
  flow: { source: string; sink: string; files: string[] },
  context: ReviewFlowFilterContext,
): boolean {
  if (context.customSources.has(flow.source) || context.customSinks.has(flow.sink)) return false;
  if (flow.source !== 'stdin') return false;
  if (!TELEMETRY_OPT_IN_STORAGE_SINKS.has(flow.sink)) return false;

  const files = new Set(flow.files);
  return TELEMETRY_OPT_IN_STORAGE_FILES.every((file) => files.has(file));
}

const BROAD_FILE_IO_REVIEW_SOURCES = new Set(['readFile', 'readFileSync']);
const BROAD_FILE_IO_REVIEW_SINKS = new Set([
  'writeFile',
  'writeFileSync',
  'unlink',
  'rm',
  'rmSync',
]);
const TELEMETRY_OPT_IN_STORAGE_FILES = [
  'src/cli/commands/init.ts',
  'src/core/telemetry.ts',
  'src/core/telemetryConfig.ts',
];
const TELEMETRY_OPT_IN_STORAGE_SINKS = new Set(['writeFile', 'rm']);
