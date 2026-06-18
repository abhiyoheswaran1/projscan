import { scanRepository } from './repositoryScanner.js';
import { collectIssues } from './issueEngine.js';
import { safeReviewEvidence } from './preflightReviewEvidence.js';
import { safeChangedFiles } from './preflightChangedFiles.js';
import { safeCoordination, safeHotspots, safeSession } from './preflightLocalEvidence.js';
import { loadConfig, applyConfigToIssues } from '../utils/config.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import type { FileEntry, Issue, PreflightMode } from '../types.js';

export interface LoadPreflightInputsOptions {
  baseRef?: string;
  headRef?: string;
  enablePlugins?: boolean;
}

export async function loadPreflightInputs(
  rootPath: string,
  mode: PreflightMode,
  options: LoadPreflightInputsOptions = {},
) {
  const configResult = await loadConfig(rootPath).catch(() => ({ config: { ignore: [] } }));
  const scan = await scanRepository(rootPath, { ignore: configResult.config.ignore });
  const issues = applyConfigToIssues(
    await collectIssuesWithPluginOption(rootPath, scan.files, options.enablePlugins),
    configResult.config,
  );
  const health = calculateScore(issues);
  const changedFiles = await safeChangedFiles(rootPath, mode, options.baseRef);
  const session = await safeSession(rootPath);
  const hotspots = await safeHotspots(rootPath, scan.files, issues);
  const review = await safeReviewEvidence(rootPath, mode, options);
  const coordination = await safeCoordination(rootPath, options.baseRef);

  return {
    issues,
    health,
    changedFiles,
    session,
    hotspots,
    review,
    coordination,
  };
}

export type PreflightInputs = Awaited<ReturnType<typeof loadPreflightInputs>>;

async function collectIssuesWithPluginOption(
  rootPath: string,
  files: FileEntry[],
  _enablePlugins?: boolean,
): Promise<Issue[]> {
  return collectIssues(rootPath, files);
}
