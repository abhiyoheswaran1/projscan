import type { FileEntry, FileHotspot, HotspotReport, Issue } from '../types.js';
import { indexIssuesByFile } from './hotspotIssues.js';

interface FileInspectionEvidenceInput {
  files: FileEntry[];
  issues: Issue[];
  hotspots: HotspotReport | undefined;
  relativePath: string;
}

interface FileInspectionEvidence {
  hotspot: FileHotspot | null;
  issues: Issue[];
}

export function collectFileInspectionEvidence(
  input: FileInspectionEvidenceInput,
): FileInspectionEvidence {
  const relatedIssueIds = new Set(
    indexIssuesByFile(input.issues, input.files).get(input.relativePath) ?? [],
  );

  return {
    hotspot: findHotspotForFile(input.hotspots, input.relativePath),
    issues: input.issues.filter((issue) => relatedIssueIds.has(issue.id)),
  };
}

function findHotspotForFile(
  report: HotspotReport | undefined,
  relativePath: string,
): FileHotspot | null {
  if (!report || !report.available) return null;
  return report.hotspots.find((h) => h.relativePath === relativePath) ?? null;
}
