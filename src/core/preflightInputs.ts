import { scanRepository } from './repositoryScanner.js';
import { collectIssues } from './issueEngine.js';
import { safeReviewEvidence } from './preflightReviewEvidence.js';
import { changedFilesFromResult, safeChangedFiles } from './preflightChangedFiles.js';
import { safeCoordination, safeHotspots, safeSession } from './preflightLocalEvidence.js';
import { loadConfig, applyConfigToIssues } from '../utils/config.js';
import { calculateScore } from '../utils/scoreCalculator.js';
import type { LoadedConfig, PreflightMode } from '../types.js';
import type { ChangedFilesResult } from '../utils/changedFiles.js';

export interface LoadPreflightInputsOptions {
  baseRef?: string;
  headRef?: string;
  enablePlugins?: boolean;
  changedFiles?: ChangedFilesResult;
}

export interface PreflightInputDependencies {
  loadConfig: typeof loadConfig;
  scanRepository: typeof scanRepository;
  collectIssues: typeof collectIssues;
  applyConfigToIssues: typeof applyConfigToIssues;
  calculateScore: typeof calculateScore;
  safeChangedFiles: typeof safeChangedFiles;
  safeSession: typeof safeSession;
  safeHotspots: typeof safeHotspots;
  safeReviewEvidence: typeof safeReviewEvidence;
  safeCoordination: typeof safeCoordination;
}

const DEFAULT_PREFLIGHT_INPUT_DEPS: PreflightInputDependencies = {
  loadConfig,
  scanRepository,
  collectIssues,
  applyConfigToIssues,
  calculateScore,
  safeChangedFiles,
  safeSession,
  safeHotspots,
  safeReviewEvidence,
  safeCoordination,
};

export async function loadPreflightInputs(
  rootPath: string,
  mode: PreflightMode,
  options: LoadPreflightInputsOptions = {},
) {
  return loadPreflightInputsWithDeps(rootPath, mode, options, DEFAULT_PREFLIGHT_INPUT_DEPS);
}

export async function loadPreflightInputsWithDeps(
  rootPath: string,
  mode: PreflightMode,
  options: LoadPreflightInputsOptions = {},
  deps: PreflightInputDependencies = DEFAULT_PREFLIGHT_INPUT_DEPS,
) {
  const configResult = await deps
    .loadConfig(rootPath)
    .catch((): LoadedConfig => ({ config: {}, source: null }));
  const changedFilesPromise = options.changedFiles
    ? Promise.resolve(changedFilesFromResult(options.changedFiles))
    : deps.safeChangedFiles(rootPath, mode, options.baseRef);
  const sessionPromise = deps.safeSession(rootPath);
  const reviewPromise = deps.safeReviewEvidence(rootPath, mode, options);
  const scan = await deps.scanRepository(rootPath, {
    ignore: configResult.config.ignore,
    includeIgnored: configResult.config.scan?.includeIgnored,
    countIgnoredFiles: false,
    useConfig: false,
  });
  const issues = deps.applyConfigToIssues(
    await deps.collectIssues(rootPath, scan.files, {
      scanEnvValues: configResult.config.scan?.scanEnvValues === true,
      useConfig: false,
    }),
    configResult.config,
  );
  const health = deps.calculateScore(issues);
  const hotspotsPromise = deps.safeHotspots(rootPath, scan.files, issues);
  const [changedFiles, session, hotspots, review] = await Promise.all([
    changedFilesPromise,
    sessionPromise,
    hotspotsPromise,
    reviewPromise,
  ]);
  const coordination = await deps.safeCoordination(rootPath, options.baseRef);

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
