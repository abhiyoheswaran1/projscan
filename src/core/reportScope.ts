import type { AnalysisReport, Issue } from '../types.js';
import type { ReportPolicyPreset } from '../types/config.js';
import {
  applyReportControlsToDependencies,
  applyReportControlsToIssuesWithRedactor,
  buildDirectoryTree,
  countDirectories,
  filterFilesByScope,
  normalizeScopes,
  redactFileEntry,
} from './reportScopeFiltering.js';
import {
  createPathRedactor,
  normalizeReportPath,
} from './reportPathRedaction.js';

export interface ReportControlOptions {
  scopes?: string[];
  redactPaths?: boolean;
}

export interface ReportControlsMetadata {
  active: true;
  scopeCount: number;
  redactPaths: boolean;
  pathLabelFormat?: 'redacted-path-N';
}

interface ResolveReportControlsInput {
  reportPolicies?: Record<string, ReportPolicyPreset>;
  reportPolicy?: unknown;
  reportScope?: unknown;
  redactPaths?: unknown;
}

export function parseReportScopes(input: unknown): string[] {
  if (typeof input !== 'string') return [];
  return input
    .split(',')
    .map(normalizeReportPath)
    .filter((scope): scope is string => Boolean(scope));
}

export function resolveReportControls(input: ResolveReportControlsInput): ReportControlOptions {
  let controls: ReportControlOptions = {};
  if (typeof input.reportPolicy === 'string') {
    const policyName = input.reportPolicy.trim();
    if (!policyName) {
      throw new Error(
        'Missing report policy name. Pass --report-policy <name> with a configured preset.',
      );
    }
    const policy = input.reportPolicies?.[policyName];
    if (!policy) {
      throw new Error(
        `Unknown report policy "${policyName}". Define reportPolicies.${policyName} in .projscanrc.json or remove --report-policy.`,
      );
    }
    controls = {
      scopes: normalizeScopes(policy.reportScope),
      redactPaths: policy.redactPaths === true,
    };
  }

  const directScopes = parseReportScopes(input.reportScope);
  if (directScopes.length > 0) controls.scopes = directScopes;
  if (input.redactPaths === true) controls.redactPaths = true;

  return controls;
}

export function applyReportControlsToIssues(
  issues: Issue[],
  options: ReportControlOptions = {},
): Issue[] {
  return applyReportControlsToIssuesWithRedactor(
    issues,
    normalizeScopes(options.scopes),
    options.redactPaths ? createPathRedactor() : null,
  );
}

export function reportControlsMetadata(
  options: ReportControlOptions = {},
): ReportControlsMetadata | undefined {
  const scopes = normalizeScopes(options.scopes);
  const redactPaths = options.redactPaths === true;
  if (scopes.length === 0 && !redactPaths) return undefined;
  return {
    active: true,
    scopeCount: scopes.length,
    redactPaths,
    ...(redactPaths ? { pathLabelFormat: 'redacted-path-N' } : {}),
  };
}

export function applyReportControlsToAnalysis(
  report: AnalysisReport,
  options: ReportControlOptions = {},
): AnalysisReport {
  const scopes = normalizeScopes(options.scopes);
  const redactor = options.redactPaths ? createPathRedactor() : null;
  const files = filterFilesByScope(report.scan.files, scopes).map((file) =>
    redactFileEntry(file, redactor),
  );
  const issues = applyReportControlsToIssuesWithRedactor(report.issues, scopes, redactor);
  const dependencies = applyReportControlsToDependencies(report.dependencies, scopes, redactor);
  const redactedRoot = redactor ? '<redacted-root>' : report.rootPath;

  return {
    ...report,
    rootPath: redactedRoot,
    scan: {
      ...report.scan,
      rootPath: redactedRoot,
      totalFiles: files.length,
      totalDirectories: countDirectories(files),
      files,
      directoryTree:
        scopes.length > 0 || redactor
          ? buildDirectoryTree(redactor ? '<redacted-root>' : report.scan.directoryTree.name, files)
          : report.scan.directoryTree,
    },
    dependencies,
    issues,
  };
}
