import type { CodeGraph } from './codeGraph.js';
import { isGeneratedLikePath, isTestLikePath } from './pathClassifiers.js';
import type { DataflowRisk } from '../types.js';

export interface DataflowRiskFilterContext {
  graph: CodeGraph;
  customSources: Set<string>;
  customSinks: Set<string>;
  includeTests: boolean;
  includeBroadFileIo: boolean;
  includeGenerated: boolean;
}

const BROAD_FILE_IO_DATAFLOW_SOURCES = new Set(['readFile', 'readFileSync']);
const BROAD_FILE_IO_DATAFLOW_SINKS = new Set(['writeFile', 'writeFileSync', 'unlink', 'rm', 'rmSync']);
const JAVASCRIPT_CHILD_PROCESS_SINKS = new Set(['exec', 'execSync', 'spawn', 'spawnSync']);

export function shouldIncludeDataflowRisk(
  risk: DataflowRisk,
  context: DataflowRiskFilterContext,
  sinkFile = risk.files[risk.files.length - 1],
): boolean {
  if (!context.includeTests && risk.files.some(isTestLikePath)) return false;
  if (!context.includeGenerated && isDefaultGeneratedCodeRisk(risk, context)) return false;
  if (!context.includeBroadFileIo && isDefaultBroadFileIoRisk(risk, context)) return false;
  if (isDefaultMisidentifiedJavaScriptShellSink(risk, context, sinkFile)) return false;
  return true;
}

function isDefaultGeneratedCodeRisk(risk: DataflowRisk, context: DataflowRiskFilterContext): boolean {
  if (!risk.files.some(isGeneratedLikePath)) return false;
  return !context.customSources.has(risk.source) && !context.customSinks.has(risk.sink);
}

function isDefaultBroadFileIoRisk(risk: DataflowRisk, context: DataflowRiskFilterContext): boolean {
  const defaultSource = !context.customSources.has(risk.source);
  const defaultSink = !context.customSinks.has(risk.sink);
  if (!defaultSource || !defaultSink) return false;
  return (
    BROAD_FILE_IO_DATAFLOW_SOURCES.has(risk.source) ||
    BROAD_FILE_IO_DATAFLOW_SINKS.has(risk.sink)
  );
}

function isDefaultMisidentifiedJavaScriptShellSink(
  risk: DataflowRisk,
  context: DataflowRiskFilterContext,
  sinkFile: string | undefined,
): boolean {
  if (!sinkFile) return false;
  if (context.customSinks.has(risk.sink)) return false;
  if (!JAVASCRIPT_CHILD_PROCESS_SINKS.has(risk.sink)) return false;
  const entry = context.graph.files.get(sinkFile);
  if (!entry || !isJavaScriptLikeFile(sinkFile, entry.adapterId)) return false;
  return !entry.imports.some(
    (imp) =>
      (imp.source === 'node:child_process' || imp.source === 'child_process') &&
      (imp.specifiers.includes(risk.sink) || imp.specifiers.length === 0),
  );
}

function isJavaScriptLikeFile(file: string, adapterId?: string): boolean {
  return adapterId === 'javascript' || /\.(?:cjs|mjs|js|jsx|ts|tsx)$/.test(file);
}
