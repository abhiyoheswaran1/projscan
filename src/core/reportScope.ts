import type { AnalysisReport, DirectoryNode, FileEntry, Issue, IssueLocation } from '../types.js';
import type { ReportPolicyPreset } from '../types/config.js';

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
    issues,
  };
}

function applyReportControlsToIssuesWithRedactor(
  issues: Issue[],
  scopes: string[],
  redactor: PathRedactor | null,
): Issue[] {
  const out: Issue[] = [];
  for (const issue of issues) {
    const scopedLocations = filterLocationsByScope(issue.locations, scopes);
    if (scopes.length > 0 && scopedLocations.length === 0) continue;
    out.push(redactIssue(issue, scopedLocations, redactor));
  }
  return out;
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  return [...new Set((scopes ?? []).map(normalizeReportPath).filter(Boolean) as string[])];
}

function normalizeReportPath(value: string): string | null {
  let normalized = value.trim().replace(/\\/g, '/');
  normalized = normalized.replace(/\/+/g, '/');
  normalized = normalized.replace(/^\.\//, '');
  normalized = normalized.replace(/\/$/, '');
  if (!normalized || normalized === '.') return null;
  return normalized;
}

function isInScope(filePath: string, scopes: string[]): boolean {
  if (scopes.length === 0) return true;
  const normalized = normalizeReportPath(filePath);
  if (!normalized) return false;
  return scopes.some((scope) => normalized === scope || normalized.startsWith(`${scope}/`));
}

function filterLocationsByScope(
  locations: IssueLocation[] | undefined,
  scopes: string[],
): IssueLocation[] {
  if (!locations || locations.length === 0) return [];
  return locations.filter((loc) => loc.file && isInScope(loc.file, scopes));
}

function filterFilesByScope(files: FileEntry[], scopes: string[]): FileEntry[] {
  if (scopes.length === 0) return [...files];
  return files.filter((file) => isInScope(file.relativePath, scopes));
}

type PathRedactor = (filePath: string) => string;

function createPathRedactor(): PathRedactor {
  const seen = new Map<string, string>();
  return (filePath: string): string => {
    const normalized = normalizeReportPath(filePath) ?? filePath;
    const existing = seen.get(normalized);
    if (existing) return existing;
    const next = `redacted-path-${seen.size + 1}`;
    seen.set(normalized, next);
    return next;
  };
}

function redactLocations(
  locations: IssueLocation[],
  redactor: PathRedactor | null,
): IssueLocation[] {
  if (!redactor) return locations.map((loc) => ({ ...loc }));
  return locations.map((loc) => ({ ...loc, file: redactor(loc.file) }));
}

function redactIssue(
  issue: Issue,
  scopedLocations: IssueLocation[],
  redactor: PathRedactor | null,
): Issue {
  const redactedLocations = redactLocations(scopedLocations, redactor);
  const redactedIssue: Issue = {
    ...issue,
    ...(scopedLocations.length > 0 || issue.locations ? { locations: redactedLocations } : {}),
  };
  if (!redactor) return redactedIssue;

  const textLocations = issue.locations ?? scopedLocations;
  const replacements = textLocations
    .filter((loc) => loc.file)
    .map((loc) => [loc.file, redactor(loc.file)] as const);
  redactedIssue.title = redactText(redactedIssue.title, replacements, redactor);
  redactedIssue.description = redactText(redactedIssue.description, replacements, redactor);
  if (redactedIssue.suggestedAction) {
    redactedIssue.suggestedAction = {
      ...redactedIssue.suggestedAction,
      summary: redactText(redactedIssue.suggestedAction.summary, replacements, redactor),
    };
  }
  return redactedIssue;
}

function redactText(
  text: string,
  replacements: ReadonlyArray<readonly [string, string]>,
  redactor: PathRedactor | null,
): string {
  let out = text;
  const ordered = [...replacements].sort((a, b) => b[0].length - a[0].length);
  for (const [filePath, label] of ordered) {
    out = out.replace(pathReferenceRegExp(filePath), label);
  }
  if (redactor) out = redactUnmappedPathTokens(out, redactor);
  return out;
}

const TEXT_PATH_TOKEN_PATTERN =
  /(?:[A-Za-z]:[\\/]|\/|\.{1,2}[\\/])?(?:[A-Za-z0-9._@-]+[\\/])+[A-Za-z0-9._@-]+\.(?:ts|tsx|js|jsx|mjs|cjs|mts|cts|py|go|java|rb|rs|php|cs|json|ya?ml|toml|md)(?=$|[\s'"()[\]{}<>.,;:!?#])/gi;

function redactUnmappedPathTokens(text: string, redactor: PathRedactor): string {
  return text.replace(TEXT_PATH_TOKEN_PATTERN, (match, ...args) => {
    const offset = args[args.length - 2] as number;
    if (isHttpUrlPathToken(text, offset)) return match;
    return redactor(match);
  });
}

function isHttpUrlPathToken(text: string, offset: number): boolean {
  const tokenStart = previousTokenStart(text, offset);
  const prefix = text.slice(tokenStart, Math.min(text.length, offset + 2)).toLowerCase();
  return prefix.startsWith('http://') || prefix.startsWith('https://');
}

function previousTokenStart(text: string, offset: number): number {
  let index = offset;
  while (index > 0 && !isPathTokenBoundary(text[index - 1])) index -= 1;
  return index;
}

function isPathTokenBoundary(char: string | undefined): boolean {
  return char === undefined || /[\s'"()[\]{}<>]/.test(char);
}

function pathReferenceRegExp(filePath: string): RegExp {
  const normalized = filePath.replace(/\\/g, '/');
  const pathPattern = normalized.split('/').map(escapeRegExp).join(String.raw`[\\/]`);
  const tokenEnd = String.raw`(?=$|[\s'"()[\]{}<>.,;:!?#])`;
  return new RegExp(String.raw`(?:\S+[\\/])*` + pathPattern + tokenEnd, 'g');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactFileEntry(file: FileEntry, redactor: PathRedactor | null): FileEntry {
  if (!redactor) return { ...file };
  const relativePath = redactor(file.relativePath);
  return {
    ...file,
    relativePath,
    absolutePath: relativePath,
    directory: '.',
  };
}

function countDirectories(files: FileEntry[]): number {
  const dirs = new Set(files.map((file) => file.directory || '.'));
  return dirs.size;
}

function buildDirectoryTree(name: string, files: FileEntry[]): DirectoryNode {
  return {
    name,
    path: '.',
    fileCount: files.length,
    totalFileCount: files.length,
    children: [],
  };
}
