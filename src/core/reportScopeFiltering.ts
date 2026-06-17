import type { AnalysisReport, DirectoryNode, FileEntry, Issue, IssueLocation } from '../types.js';
import { normalizeReportPath, redactText, type PathRedactor } from './reportPathRedaction.js';

export function applyReportControlsToDependencies(
  dependencies: AnalysisReport['dependencies'],
  scopes: string[],
  redactor: PathRedactor | null,
): AnalysisReport['dependencies'] {
  if (!dependencies?.byWorkspace) return dependencies;
  return {
    ...dependencies,
    byWorkspace: dependencies.byWorkspace
      .filter((workspace) => dependencyWorkspaceInScope(workspace.relativePath, scopes))
      .map((workspace) => ({
        ...workspace,
        relativePath:
          redactor && workspace.relativePath ? redactor(workspace.relativePath) : workspace.relativePath,
      })),
  };
}

export function applyReportControlsToIssuesWithRedactor(
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

export function normalizeScopes(scopes: string[] | undefined): string[] {
  return [...new Set((scopes ?? []).map(normalizeReportPath).filter(Boolean) as string[])];
}

export function filterFilesByScope(files: FileEntry[], scopes: string[]): FileEntry[] {
  if (scopes.length === 0) return [...files];
  return files.filter((file) => isInScope(file.relativePath, scopes));
}

export function redactFileEntry(file: FileEntry, redactor: PathRedactor | null): FileEntry {
  if (!redactor) return { ...file };
  const relativePath = redactor(file.relativePath);
  return {
    ...file,
    relativePath,
    absolutePath: relativePath,
    directory: '.',
  };
}

export function countDirectories(files: FileEntry[]): number {
  const dirs = new Set(files.map((file) => file.directory || '.'));
  return dirs.size;
}

export function buildDirectoryTree(name: string, files: FileEntry[]): DirectoryNode {
  return {
    name,
    path: '.',
    fileCount: files.length,
    totalFileCount: files.length,
    children: [],
  };
}

function dependencyWorkspaceInScope(relativePath: string, scopes: string[]): boolean {
  if (scopes.length === 0) return true;
  return isInScope(relativePath, scopes);
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
