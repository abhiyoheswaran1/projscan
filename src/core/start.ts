import { loadStartInputs } from './startInputs.js';
import { normalizeStartOptions, type ComputeStartOptions } from './startOptions.js';
import { buildStartReportContext } from './startReportContext.js';
import { buildStartReport } from './startReportBuilder.js';
import type { StartReport } from '../types/start.js';

export type { ComputeStartOptions };

export async function computeStartReport(
  rootPath: string,
  options: ComputeStartOptions = {},
): Promise<StartReport> {
  const { intent, modeResolution, mode, maxTasks, maxRisks } = normalizeStartOptions(options);
  const inputs = await loadStartInputs(rootPath, options, { mode, maxTasks, maxRisks });
  const { setup, workplan, quality, riskSources } = inputs;
  const context = buildStartReportContext({ ...inputs, mode, intent, maxRisks });
  return buildStartReport({
    rootPath,
    mode,
    modeSource: modeResolution.source,
    modeReason: modeResolution.reason,
    setup,
    workplan,
    quality,
    riskSources,
    ...context,
    includeHandoff: options.includeHandoff,
  });
}
