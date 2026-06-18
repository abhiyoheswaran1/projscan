import { loadPreflightInputs } from './preflightInputs.js';
import { buildPreflightReport } from './preflightReport.js';
import type {
  PreflightMode,
  PreflightReport,
} from '../types.js';

export { decidePreflightVerdict, summarizePreflight } from './preflightVerdict.js';

export interface ComputePreflightOptions {
  mode?: PreflightMode;
  baseRef?: string;
  headRef?: string;
  maxChangedFiles?: number;
  enablePlugins?: boolean;
}

const DEFAULT_MAX_CHANGED_FILES = 50;

export async function computePreflight(
  rootPath: string,
  options: ComputePreflightOptions = {},
): Promise<PreflightReport> {
  const mode = options.mode ?? 'before_edit';
  const inputs = await loadPreflightInputs(rootPath, mode, options);
  const maxChangedFiles = options.maxChangedFiles ?? DEFAULT_MAX_CHANGED_FILES;
  return buildPreflightReport({ mode, inputs, maxChangedFiles });
}
